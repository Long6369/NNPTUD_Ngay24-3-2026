let express = require('express')
let router = express.Router()
let upload = require('../utils/uploadHandler')
let path = require('path')

router.post('/one_image', upload.single('file'), function (req, res, next) {
    if (!req.file) {
        res.status(404).send({
            message: "file not found"
        })
    } else {
        res.send({
            filename: req.file.filename,
            path: req.file.path,
            size: req.file.size
        })
    }
})
router.post('/multiple_images', upload.array('files', 5), function (req, res, next) {
    if (!req.files) {
        res.status(404).send({
            message: "file not found"
        })
    } else {
        res.send(req.files.map(f => ({
            filename: f.filename,
            path: f.path,
            size: f.size
        })))
    }
})
router.get('/:filename', function (req, res, next) {
    let pathFile = path.join(
        __dirname,'../uploads',req.params.filename
    )
    res.sendFile(pathFile)
})

module.exports = router;