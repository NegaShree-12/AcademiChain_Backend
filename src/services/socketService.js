import { Server } from "socket.io";
import jwt from "jsonwebtoken";

class SocketService {
  constructor(server) {
    this.io = new Server(server, {
      cors: {
        origin: process.env.FRONTEND_URL || "http://localhost:3000",
        credentials: true,
      },
    });

    this.users = new Map();
    this.setupSocketEvents();
  }

  setupSocketEvents() {
    this.io.on("connection", (socket) => {
      console.log("New socket:", socket.id);

      socket.on("authenticate", (token) => {
        try {
          const decoded = jwt.verify(token, process.env.JWT_SECRET);

          const user = {
            userId: decoded.userId,
            role: decoded.role,
            socketId: socket.id,
          };

          this.users.set(socket.id, user);

          socket.join(decoded.role);
          socket.emit("authenticated", { success: true });
        } catch (err) {
          socket.emit("authentication_error", { message: "Invalid token" });
          socket.disconnect();
        }
      });

      socket.on("disconnect", () => {
        this.users.delete(socket.id);
      });
    });
  }

  notifyRole(role, event, data) {
    this.io.to(role).emit(event, data);
  }

  broadcast(event, data) {
    this.io.emit(event, data);
  }
}

export default SocketService;
