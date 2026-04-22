import jwt from "jsonwebtoken";

const verifyToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];

    if(!authHeader) {
        return res.status(403).json({
            success: false,
            message: "No token provided , access denied"
        })
    };

    const token = authHeader.split(' ')[1];

    if(!token) {
        return res.status(403).json({
            success: false,
            message: "Invalid token format , use <Bearer> format"
        })
    }

    jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
        if(err) {
            return res.status(401).json({
                success: false,
                message: "Invalid or expired token, authorization failed"
            })
        }

        req.user = decoded;

        next();
    })
}

export default verifyToken;