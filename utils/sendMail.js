const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
    host: "live.smtp.mailtrap.io",
    port: 587,
    secure: false,
    auth: {
        user: "api",
        pass: "2df1915c186d257b46cf2865d9f6d908",
    },
});

module.exports = {
    sendMail: async function (to, url) {
        await transporter.sendMail({
            from: 'admin@freewing.com',
            to: to,
            subject: "reset password email",
            text: "click vao day de doi pass",
            html: "click vao <a href=" + url+ ">day</a> de doi pass",
        })
    },
    sendPasswordMail: async function (to, username, password) {
        await transporter.sendMail({
            from: 'admin@freewing.com',
            to: to,
            subject: "Thong tin tai khoan cua ban",
            text: "Username: " + username + "\nPassword: " + password,
            html: "<h3>Thong tin tai khoan</h3>"
                + "<p><b>Username:</b> " + username + "</p>"
                + "<p><b>Password:</b> " + password + "</p>"
                + "<p>Vui long doi mat khau sau khi dang nhap.</p>",
        })
    }
}

// Send an email using async/await
