const fs = require('fs');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Products = require('./../../models/productModel');
dotenv.config({ path: './config.env' });

const DB = process.env.DATABASE.replace(
  '<PASSWORD>',
  process.env.DATABASE_PASSWORD
);

mongoose.connect(DB).then(() => {
  console.log('DB connection successful!');
});

const products = JSON.parse(fs.readFileSync(`${__dirname}/import-data.json`));

const importData = async () => {
  try {
    await Products.create(products);
    console.log('Data successfully loaded');
  } catch (err) {
    console.log(err);
  }
};
const deleteData = async () => {
  try {
    await Products.deleteMany();
    console.log('Data successfully deleted');
  } catch (err) {
    console.log(err);
  }
  process.exit();
};

if (process.argv[2] === '--import') {
  importData();
} else if (process.argv[2] === '--delete') {
  deleteData();
}
