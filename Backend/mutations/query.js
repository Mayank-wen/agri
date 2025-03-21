const { User, Product, Order } = require("../models");

const resolvers = {
  Query: {
    // User Queries
    getUser: async (_, { id }) => {
      return await User.findById(id);
    },

    // Product Queries
    getProducts: async () => {
      return await Product.find().populate("seller");
    },
    getProduct: async (_, { id }) => {
      return await Product.findById(id).populate("seller");
    },
    getProductsByCategory: async (_, { category }) => {
      return await Product.find({ category }).populate("seller");
    },
    getUserProducts: async (_, __, { user }) => {
      if (!user) throw new Error("Not authenticated");
      return await Product.find({ seller: user.id });
    },

    getFarmerOrders: async (_, __, { user }) => {
      if (!user || user.role !== "farmer") {
        throw new Error("Not authorized");
      }

      return await Order.find({
        "products.product": {
          $in: await Product.find({ seller: user.id }).select("_id"),
        },
      })
        .populate("buyer")
        .populate("products.product");
    },

    getBuyerOrders: async (_, __, { user }) => {
      if (!user) throw new Error("Not authenticated");
      return await Order.find({ buyer: user.id })
        .populate("products.product")
        .populate({
          path: "products.product",
          populate: {
            path: "seller",
          },
        });
    },

    // Transaction Queries
    getTransactions: async (_, __, { user }) => {
      if (!user || user.role !== "farmer") {
        throw new Error("Not authorized");
      }
      const farmerProducts = await Product.find({ seller: user.id }).select(
        "_id"
      );
      return await Order.find({
        "products.product": { $in: farmerProducts },
        status: { $in: ["completed", "delivered"] },
      })
        .populate("buyer")
        .populate("products.product");
    },

    // Dashboard Stats
    getDashboardStats: async (_, __, { user }) => {
      if (!user) throw new Error("Not authenticated");

      const stats = {
        totalOrders: 0,
        totalRevenue: 0,
        activeListings: 0,
        recentTransactions: [],
      };

      if (user.role === "farmer") {
        const products = await Product.find({ seller: user.id });
        stats.activeListings = products.length;

        const orders = await Order.find({
          "products.product": {
            $in: products.map((p) => p._id),
          },
          status: "completed",
        }).populate("buyer");

        stats.totalOrders = orders.length;
        stats.totalRevenue = orders.reduce(
          (sum, order) => sum + order.total,
          0
        );
        stats.recentTransactions = orders.slice(0, 5);
      } else {
        const orders = await Order.find({
          buyer: user.id,
        }).populate("products.product");

        stats.totalOrders = orders.length;
        stats.totalRevenue = orders.reduce(
          (sum, order) => sum + order.total,
          0
        );
        stats.recentTransactions = orders.slice(0, 5);
      }

      return stats;
    },
  },
};

module.exports = resolvers;
