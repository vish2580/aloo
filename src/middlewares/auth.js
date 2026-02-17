const jwt = require("jsonwebtoken");

const authenticateToken = (req, res, next) => {
  console.log("🔐 [AUTH] authenticateToken called for:", req.method, req.path);

  const authHeader = req.headers["authorization"];
  console.log("🔐 [AUTH] Authorization header:", authHeader ? "present" : "missing");

  const token = authHeader && authHeader.split(" ")[1]; // Bearer TOKEN

  if (!token) {
    console.log("🔐 [AUTH] No token found, sending 401");
    return res
      .status(401)
      .json({ success: false, message: "Access token required" });
  }

  console.log("🔐 [AUTH] Token found, verifying...");
  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      console.log("🔐 [AUTH] Token verification failed:", err.message);
      return res
        .status(403)
        .json({ success: false, message: "Invalid or expired token" });
    }
    console.log("🔐 [AUTH] Token verified successfully, user:", user.userId);
    req.user = user; // { userId }
    next();
  });
};

module.exports = authenticateToken;
