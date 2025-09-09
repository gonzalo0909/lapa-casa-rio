"use strict";
const express = require("express");
const app = express();

app.use("/availability", require("./routes/availability"));
app.use("/bookings", require("./routes/bookings"));
app.use("/holds", require("./routes/holds").router);
app.use("/payments", require("./routes/payments").router);
app.use("/ical", require("./routes/ical"));

module.exports = app;
