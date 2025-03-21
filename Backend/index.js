const express = require("express");
const { ApolloServer } = require("apollo-server-express");
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const cors = require("cors");
require("dotenv").config();

// Import schema and resolvers
const typeDefs = require("./schema");
const query = require("./mutations/query");
const mutation = require("./mutations/mutations");

const app = express();
app.use(cors());

// Combine resolvers
const resolvers = {
  Query: query.Query,
  Mutation: mutation.Mutation,
};

// Context middleware for authentication
const context = ({ req }) => {
  const auth = req.headers.authorization || "";
  console.log("Auth header:", auth);

  if (auth) {
    try {
      // Remove quotes from the token string
      const token = auth.replace(/"/g, "");
      console.log("Cleaned token:", token);

      const decodedToken = jwt.verify(token, process.env.JWT_SECRET);
      console.log("Decoded token:", decodedToken);

      const user = {
        id: decodedToken.id,
        email: decodedToken.email,
        role: decodedToken.role,
      };
      console.log("Authenticated user:", user);
      return { user };
    } catch (error) {
      console.error("Token verification failed:", error.message);
    }
  }
  console.log("No auth token provided");
  return { user: null };
};

async function startApolloServer() {
  const server = new ApolloServer({
    typeDefs,
    resolvers,
    context,
    formatError: (error) => {
      console.error("GraphQL Error:", error);
      return {
        message: error.message,
        path: error.path,
      };
    },
  });

  await server.start();
  server.applyMiddleware({ app });

  // Modern MongoDB Connection
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
      family: 4,
    });

    console.log("Connected to MongoDB");

    const PORT = process.env.PORT || 4000;
    app.listen(PORT, () => {
      console.log(`
                🚀 Server ready at http://localhost:${PORT}${server.graphqlPath}
                📚 MongoDB connected
                🔑 Authentication enabled
            `);
    });
  } catch (err) {
    console.error("MongoDB connection error:", err);
    process.exit(1);
  }
}

startApolloServer().catch((error) => {
  console.error("Server startup error:", error);
  process.exit(1);
});

process.on("unhandledRejection", (error) => {
  console.error("Unhandled Rejection:", error);
});
