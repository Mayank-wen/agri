const { User, Product, Order } = require("../models");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const resolvers = {
  Mutation: {
    // Auth Mutations
    signup: async (_, { input }) => {
      try {
        const { name, email, password, role } = input;

        // Check existing user
        const existingUser = await User.findOne({ email });
        if (existingUser) {
          throw new Error("Email already registered");
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Create new user
        const user = new User({
          name,
          email,
          password: hashedPassword,
          role: role || "buyer",
          createdAt: (() => {
            const date = new Date();
            const day = date.getDate().toString().padStart(2, "0");
            const month = (date.getMonth() + 1).toString().padStart(2, "0");
            const year = date.getFullYear();
            const hours = date.getHours().toString().padStart(2, "0");
            const minutes = date.getMinutes().toString().padStart(2, "0");
            return `${day}/${month}/${year} ${hours}:${minutes}`;
          })(),
        });

        await user.save();

        // Generate token
        const token = jwt.sign(
          { id: user.id, email: user.email, role: user.role },
          process.env.JWT_SECRET
        );

        return {
          token,
          user,
        };
      } catch (error) {
        throw new Error(`Signup failed: ${error.message}`);
      }
    },

    // Add console logs for debugging
    login: async (_, { input }) => {
      const { email, password } = input;
      console.log("Login attempt for email:", email);

      const user = await User.findOne({ email });
      if (!user) {
        console.log("User not found for email:", email);
        throw new Error("User not found");
      }
      console.log("Found user:", user);

      const validPassword = await bcrypt.compare(password, user.password);
      if (!validPassword) {
        console.log("Invalid password for user:", email);
        throw new Error("Invalid password");
      }
      console.log("Password validated successfully");

      // Generate token with role included
      const token = jwt.sign(
        {
          id: user.id,
          email: user.email,
          role: user.role,
        },
        process.env.JWT_SECRET
      );
      console.log("Generated token:", token);
      console.log("Token payload:", jwt.decode(token));

      return {
        token,
        user,
      };
    },

    // Product Mutations
    createProduct: async (_, { input }, { user }) => {
      if (!user || user.role !== "farmer") {
        throw new Error("Not authorized");
      }

      const product = new Product({
        ...input,
        seller: user.id,
      });

      await product.save();

      // Populate the seller information before returning
      return await Product.findById(product._id).populate("seller");
    },

    updateProduct: async (_, { id, input }, { user }) => {
      if (!user || user.role !== "farmer") {
        throw new Error("Not authorized");
      }

      const product = await Product.findById(id);
      if (!product || product.seller.toString() !== user.id) {
        throw new Error("Product not found or not authorized");
      }

      return await Product.findByIdAndUpdate(
        id,
        { ...input },
        { new: true }
      ).populate("seller");
    },

    deleteProduct: async (_, { id }, { user }) => {
      if (!user || user.role !== "farmer") {
        throw new Error("Not authorized");
      }

      const product = await Product.findById(id);
      if (!product || product.seller.toString() !== user.id) {
        throw new Error("Product not found or not authorized");
      }

      await Product.findByIdAndDelete(id);
      return true;
    },

    // Order Mutations
    createOrder: async (_, { products }, { user }) => {
      if (!user) throw new Error("Not authenticated");

      const orderItems = await Promise.all(
        products.map(async (item) => {
          const product = await Product.findById(item.productId);
          if (!product || product.quantity < item.quantity) {
            throw new Error(`Product ${product.name} is out of stock`);
          }

          // Update product quantity
          await Product.findByIdAndUpdate(item.productId, {
            $inc: { quantity: -item.quantity },
          });

          return {
            product: item.productId,
            quantity: item.quantity,
            price: product.price * item.quantity,
          };
        })
      );

      const total = orderItems.reduce((sum, item) => sum + item.price, 0);

      const order = new Order({
        buyer: user.id,
        products: orderItems,
        total,
        status: "pending",
      });

      await order.save();

      // Populate all required fields before returning
      return await Order.findById(order._id)
        .populate({
          path: "products.product",
          populate: {
            path: "seller",
          },
        })
        .populate("buyer");
    },

    updateOrderStatus: async (_, { id, status }, { user }) => {
      if (!user) throw new Error("Not authenticated");

      const order = await Order.findById(id);
      if (!order) throw new Error("Order not found");
      if (user.role !== "farmer") {
        throw new Error("Not authorized to update order status");
      }

      return await Order.findByIdAndUpdate(
        id,
        { status },
        { new: true }
      ).populate("buyer");
    },
  },
};

module.exports = resolvers;
