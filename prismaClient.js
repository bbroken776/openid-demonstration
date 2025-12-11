// prismaClient.js
// Central PrismaClient instance so it can be reused and, if needed, mocked in tests.

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

module.exports = prisma;
