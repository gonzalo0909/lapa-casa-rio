"use strict";

const cookieSession = require("cookie-session");

const SECRET  = process.env.ADMIN_SESSION_SECRET || process.env.JWT_SECRET || "change-me";
const PROD    = String(process.env.NODE_ENV||"").toLowerCase()==="production";

module.exports = cookieSession({
  name: "lapa_admin",
  secret: SECRET,
  maxAge: 7*24*3600*1000,
  sameSite: "lax",
  httpOnly: true,
  secure: PROD,
});
