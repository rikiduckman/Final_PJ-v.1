module.exports.isAuthenticated = (req, res, next) => {
    if (req.isAuthenticated()) {
        return next();
    } else {
        res.status(403).send('<script>alert("กรุณาเข้าสู่ระบบ"); window.location.href = "/";</script>');
    }
};
module.exports.isAdmin = (req, res, next) => {
    if (req.user && req.user.emails && req.user.emails[0].value && req.user.emails[0].value === process.env.ADMIN_ID) {
        return next(); 
    } else {
        res.status(403).send('<script>alert("คุณไม่มีสิทธิ์เข้าถึงหน้านี้"); window.location.href = "/";</script>');
    }
};
