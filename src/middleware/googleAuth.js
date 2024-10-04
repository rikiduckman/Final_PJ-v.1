const express = require('express');
const passport = require('../config/passport');
const router = express.Router();

router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

router.get('/google/callback', 
  passport.authenticate('google', { failureRedirect: '/login' }),
  (req, res) => {
    if (!req.user || !req.user.emails || req.user.emails.length === 0) {
      return res.redirect('/login'); 
    }
    const email = req.user.emails[0].value;
    
    if (email.endsWith('@mail.rmutk.ac.th')) {
      if (email === process.env.ADMIN_ID) {
        res.send('<script>alert("เข้าสู่ระบบแอดมินสำเร็จ"); window.location.href = "/admin";</script>');
      } else {
        res.send('<script>alert("เข้าสู่ระบบสำเร็จ"); window.location.href = "/user";</script>');
      }
    } else {
      req.logout(() => {
        res.send('<script>alert("กรุณาใช้เมลของมหาวิทยาลัยเทคโนโลยีราชมงคลกรุงเทพเท่านั้น"); window.location.href = "/";</script>');
      });
    }
  }
);

module.exports = router;
