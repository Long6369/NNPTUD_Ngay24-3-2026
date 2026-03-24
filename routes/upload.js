let express = require('express')
let router = express.Router()
let { uploadImage, uploadExcel } = require('../utils/uploadHandler')
let path = require('path')
let exceljs = require('exceljs')
let fs = require('fs')
let categoriesModel = require('../schemas/categories')
let productsModel = require('../schemas/products')
let inventoryModel = require('../schemas/inventories')
let mongoose = require('mongoose')
let slugify = require('slugify')
let crypto = require('crypto')
let userController = require('../controllers/users')
let cartModel = require('../schemas/carts')
let roleModel = require('../schemas/roles')
let { sendPasswordMail } = require('../utils/sendMail')

router.post('/one_image', uploadImage.single('file'), function (req, res, next) {
    if (!req.file) {
        res.status(404).send({
            message: "file not found"
        })
    } else {
        console.log(req.body);
        res.send({
            filename: req.file.filename,
            path: req.file.path,
            size: req.file.size
        })
    }
})
router.post('/multiple_images', uploadImage.array('files', 5), function (req, res, next) {
    if (!req.files) {
        res.status(404).send({
            message: "file not found"
        })
    } else {
        console.log(req.body);
        res.send(req.files.map(f => ({
            filename: f.filename,
            path: f.path,
            size: f.size
        })))
    }
})
router.get('/:filename', function (req, res, next) {
    let pathFile = path.join(
        __dirname, '../uploads', req.params.filename
    )
    res.sendFile(pathFile)
})

router.post('/excel', uploadExcel.single('file'), async function (req, res, next) {
    if (!req.file) {
        res.status(404).send({
            message: "file not found"
        })
    } else {
        //workbook->worksheet->column/row->cell
        let workbook = new exceljs.Workbook();
        let pathFile = path.join(
            __dirname, '../uploads', req.file.filename
        )
        await workbook.xlsx.readFile(pathFile)
        let worksheet = workbook.worksheets[0];
        let result = []
        let categories = await categoriesModel.find({
        });
        let categoriesMap = new Map();
        for (const category of categories) {
            categoriesMap.set(category.name, category._id)
        }
        let products = await productsModel.find({})
        let getTitle = products.map(p => p.title)
        let getSku = products.map(p => p.sku)

        for (let index = 2; index <= worksheet.rowCount; index++) {
            let errorsInRow = []
            const element = worksheet.getRow(index);
            let sku = element.getCell(1).value;
            let title = element.getCell(2).value;
            let category = element.getCell(3).value;

            let price = Number.parseInt(element.getCell(4).value)
            let stock = Number.parseInt(element.getCell(5).value)

            if (price < 0 || isNaN(price)) {
                errorsInRow.push("price khong hop le")
            }
            if (stock < 0 || isNaN(stock)) {
                errorsInRow.push("stock khong hop le")
            }
            if (!categoriesMap.has(category)) {
                errorsInRow.push('category khong hop le')
            }
            if (getSku.includes(sku)) {
                errorsInRow.push('sku bi trung')
            }
            if (getTitle.includes(title)) {
                errorsInRow.push('title khong hop le')
            }
            if (errorsInRow.length > 0) {
                result.push({
                    success: false,
                    data: errorsInRow
                });
                continue;
            }// 

            let session = await mongoose.startSession();
            session.startTransaction()
            try {
                let newProduct = new productsModel({
                    sku: sku,
                    title: title,
                    slug: slugify(title, {
                        replacement: '-',
                        remove: undefined,
                        lower: true,
                        strict: false,
                    }),
                    price: price,
                    description: title,
                    category: categoriesMap.get(category)
                });
                newProduct = await newProduct.save({ session });
                let newInventory = new inventoryModel({
                    product: newProduct._id,
                    stock: stock
                })
                newInventory = await newInventory.save({ session });
                newInventory = await newInventory.populate('product')
                await session.commitTransaction();
                await session.endSession()
                getTitle.push(title);
                getSku.push(sku)
                result.push({
                    success: true,
                    data: newInventory
                })
            } catch (error) {
                await session.abortTransaction();
                await session.endSession()
                result.push({
                    success: false,
                    data: error.message
                })
            }

        }
        fs.unlinkSync(pathFile)
        res.send(result.map(function (r, index) {
            if (r.success) {
                return { [index + 1]: r.data }
            } else {
                return { [index + 1]: r.data.join(',') }
            }
        }))
    }
})

router.post('/excel_users', uploadExcel.single('file'), async function (req, res, next) {
    if (!req.file) {
        return res.status(404).send({ message: "file not found" })
    }

    let workbook = new exceljs.Workbook();
    let pathFile = path.join(__dirname, '../uploads', req.file.filename)
    await workbook.xlsx.readFile(pathFile)
    let worksheet = workbook.worksheets[0];
    let result = []

    // Tim role "user"
    let userRole = await roleModel.findOne({ name: 'user', isDeleted: false })
    if (!userRole) {
        fs.unlinkSync(pathFile)
        return res.status(404).send({ message: "Role 'user' khong ton tai" })
    }

    // Lay danh sach username va email da ton tai
    let existingUsers = await require('../schemas/users').find({})
    let existingUsernames = existingUsers.map(u => u.username)
    let existingEmails = existingUsers.map(u => u.email)

    for (let index = 2; index <= worksheet.rowCount; index++) {
        let errorsInRow = []
        const row = worksheet.getRow(index);
        let username = row.getCell(1).value;
        let email = row.getCell(2).value;

        if (!username || String(username).trim() === '') {
            errorsInRow.push('username khong duoc rong')
        }
        if (!email || String(email).trim() === '') {
            errorsInRow.push('email khong duoc rong')
        }
        if (existingUsernames.includes(String(username))) {
            errorsInRow.push('username da ton tai')
        }
        if (existingEmails.includes(String(email).toLowerCase())) {
            errorsInRow.push('email da ton tai')
        }

        if (errorsInRow.length > 0) {
            result.push({ success: false, data: errorsInRow })
            continue;
        }

        // Random password 16 ky tu
        let password = crypto.randomBytes(8).toString('hex'); // 16 hex chars

        let session = await mongoose.startSession();
        session.startTransaction()
        try {
            let newUser = await userController.CreateAnUser(
                String(username), password, String(email),
                userRole._id, session
            )
            let newCart = new cartModel({ user: newUser._id })
            await newCart.save({ session })

            await session.commitTransaction()
            await session.endSession()

            existingUsernames.push(String(username))
            existingEmails.push(String(email).toLowerCase())

            // Gui email password cho user
            await sendPasswordMail(String(email), String(username), password)

            result.push({
                success: true,
                data: { username: String(username), email: String(email) }
            })
        } catch (error) {
            await session.abortTransaction()
            await session.endSession()
            result.push({ success: false, data: error.message })
        }
    }

    fs.unlinkSync(pathFile)
    res.send(result.map(function (r, index) {
        if (r.success) {
            return { [index + 1]: r.data }
        } else {
            if (Array.isArray(r.data)) {
                return { [index + 1]: r.data.join(',') }
            }
            return { [index + 1]: r.data }
        }
    }))
})

module.exports = router;