const { Sequelize, DataTypes } = require('sequelize');
const mysql = require('mysql2/promise');

let sequelize = null;
let SystemConfig = null; // Replaced User with SystemConfig for global settings
let Site = null;

const createDatabaseIfNotExists = async (config) => {
  try {
    const connection = await mysql.createConnection({
      host: config.host,
      port: config.port,
      user: config.username,
      password: config.password
    });
    await connection.query(`CREATE DATABASE IF NOT EXISTS \`${config.database}\`;`);
    await connection.end();
  } catch (error) {
    console.error('Failed to create database:', error);
    throw new Error('Could not connect to MySQL server or create database. Please check your credentials.');
  }
};

const initDB = async (config) => {
  await createDatabaseIfNotExists(config);

  sequelize = new Sequelize(config.database, config.username, config.password, {
    host: config.host,
    port: config.port,
    dialect: 'mysql',
    logging: false
  });

  // Stores the single 2FA secret for the system
  SystemConfig = sequelize.define('SystemConfig', {
    twoFactorSecret: {
      type: DataTypes.STRING,
      allowNull: false
    }
  });

  Site = sequelize.define('Site', {
    title: {
      type: DataTypes.STRING,
      allowNull: false
    },
    url: {
      type: DataTypes.STRING,
      allowNull: false
    },
    icon: {
      type: DataTypes.TEXT('long'),
      allowNull: true
    },
    category: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: '其他'
    }
  });

  return { sequelize, SystemConfig, Site };
};

const getDB = () => {
  if (!sequelize) {
    throw new Error('Database not initialized');
  }
  return { sequelize, SystemConfig, Site };
};

module.exports = { initDB, getDB };
