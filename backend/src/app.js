const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const cookieParser = require("cookie-parser");
const path = require("path");

const authRoutes = require("./module/auth/auth.routes");
const documentRoutes = require("./module/document/document.routes");
const searchRoutes = require("./module/search/routes/search.routes");
const chatRoutes = require("./module/chat/chat.routes");
const errorHandler = require("./middlewares/error.middleware");

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(cors());
app.use(morgan("dev"));
app.use(cookieParser());

app.use("/api/auth", authRoutes);
app.use("/api/documents", documentRoutes);
app.use("/api/v1/search", searchRoutes);
app.use("/api/v1/chat", chatRoutes);
app.use("/uploads", express.static(path.join(__dirname, "../uploads")));

app.get("/", (req, res) => {
  res.send("Server is running");
});

app.use(errorHandler);

module.exports = app;
