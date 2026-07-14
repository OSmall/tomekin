import {defineConfig} from "drizzle-kit";

export default defineConfig({
    schema: "./src/schema.ts",
    out: "./drizzle",
    dialect: "sqlite",
    dbCredentials: {
        url: process.env.TOMEKIN_DB_PATH?.trim() || ".data/tomekin.sqlite",
    },
});
