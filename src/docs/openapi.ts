import swaggerJSDoc from "swagger-jsdoc";

const FRONTEND = (process.env.FRONTEND_URL || "http://localhost:5173").replace(
  /\/$/,
  ""
);
const BACKEND = (
  process.env.BACKEND_URL ||
  process.env.APP_URL ||
  "http://localhost:4000"
).replace(/\/$/, "");

const options: swaggerJSDoc.Options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: process.env.APP_NAME || "OSVS API",
      version: process.env.APP_VERSION || "1.0.0",
      description:
        "OpenAPI specification for the OSVS backend. Add JSDoc comments to routes/controllers to expand this.",
    },
    servers: [
      { url: `${BACKEND}/api`, description: "Backend API (base)" },
      { url: FRONTEND, description: "Frontend origin" },
    ],
  },
  // Scan these files for JSDoc @openapi annotations (adjust as needed)
  apis: ["./src/routes/*.ts", "./src/controllers/*.ts"],
};

export const swaggerSpec = swaggerJSDoc(options);

export default swaggerSpec;
