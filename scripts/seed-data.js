const { faker } = require('@faker-js/faker');
const bcrypt = require('bcryptjs');
const { sequelize, User, Category, Product, Order, OrderItem } = require('../src/models');

async function seedDatabase() {
  try {
    console.log('Starting database seed...');

    // Test database connection first
    await sequelize.authenticate();
    console.log('Database connection verified');

    // Force sync will drop and recreate all tables
    await sequelize.sync({ force: true });
    console.log('Database synced with fresh tables');

    // Create categories
    const categories = [];
    const categoryNames = [
      'Electronics', 'Clothing', 'Books', 'Home & Garden', 'Sports',
      'Toys', 'Food & Beverages', 'Health & Beauty', 'Automotive', 'Jewelry',
      'Office Supplies', 'Pet Supplies', 'Music', 'Movies', 'Games',
      'Furniture', 'Tools', 'Outdoor', 'Baby', 'Shoes'
    ];

    for (const name of categoryNames) {
      const category = await Category.create({
        name,
        description: faker.lorem.sentence()
      });
      categories.push(category);
    }
    console.log(`Created ${categories.length} categories`);

    // Create users
    const users = [];
    const hashedPassword = await bcrypt.hash('password123', 10);

    // Create a test user
    const testUser = await User.create({
      username: 'testuser',
      email: 'test@example.com',
      password: hashedPassword,
      firstName: 'Test',
      lastName: 'User',
      address: {
        street: '123 Test St',
        city: 'Test City',
        state: 'TS',
        zip: '12345',
        country: 'USA'
      },
      phoneNumber: '555-0100'
    });
    users.push(testUser);

    // Create random users with guaranteed unique usernames and emails
    const usedUsernames = new Set(['testuser']);
    const usedEmails = new Set(['test@example.com']);

    for (let i = 0; i < 999; i++) {
      let username, email;

      // Ensure unique username
      do {
        username = faker.internet.userName() + '_' + i;
      } while (usedUsernames.has(username));
      usedUsernames.add(username);

      // Ensure unique email
      do {
        email = faker.internet.email();
      } while (usedEmails.has(email));
      usedEmails.add(email);

      const user = await User.create({
        username,
        email,
        password: hashedPassword,
        firstName: faker.person.firstName(),
        lastName: faker.person.lastName(),
        address: {
          street: faker.location.streetAddress(),
          city: faker.location.city(),
          state: faker.location.state({ abbreviated: true }),
          zip: faker.location.zipCode(),
          country: 'USA'
        },
        phoneNumber: faker.phone.number()
      });
      users.push(user);
    }
    console.log(`Created ${users.length} users`);

    // Create products with unique SKUs
    const products = [];
    for (let i = 0; i < 500; i++) {
      const category = categories[Math.floor(Math.random() * categories.length)];
      const product = await Product.create({
        name: faker.commerce.productName(),
        description: faker.commerce.productDescription(),
        price: faker.commerce.price({ min: 10, max: 1000, dec: 2 }),
        stock: faker.number.int({ min: 0, max: 100 }),
        sku: `SKU-${i.toString().padStart(4, '0')}-${faker.string.alphanumeric(4).toUpperCase()}`,
        imageUrl: faker.image.url(),
        categoryId: category.id,
        specifications: {
          weight: faker.number.float({ min: 0.1, max: 50, precision: 0.1 }) + ' kg',
          dimensions: `${faker.number.int({ min: 10, max: 100 })}x${faker.number.int({ min: 10, max: 100 })}x${faker.number.int({ min: 10, max: 100 })} cm`,
          material: faker.commerce.productMaterial(),
          color: faker.color.human()
        },
        tags: faker.helpers.arrayElements(
          ['bestseller', 'new', 'sale', 'featured', 'limited', 'exclusive', 'popular'],
          faker.number.int({ min: 1, max: 3 })
        )
      });
      products.push(product);
    }
    console.log(`Created ${products.length} products`);

    // Create orders
    const orders = [];
    for (let i = 0; i < 5000; i++) {
      const user = users[Math.floor(Math.random() * users.length)];
      const itemCount = faker.number.int({ min: 1, max: 5 });
      
      const order = await Order.create({
        orderNumber: `ORD-${Date.now()}-${faker.string.alphanumeric(6).toUpperCase()}`,
        userId: user.id,
        status: faker.helpers.arrayElement(['pending', 'processing', 'shipped', 'delivered', 'cancelled']),
        totalAmount: 0, // Will calculate after items
        shippingAddress: user.address,
        paymentMethod: faker.helpers.arrayElement(['credit_card', 'debit_card', 'paypal', 'bank_transfer']),
        notes: faker.lorem.sentence()
      });

      let totalAmount = 0;
      for (let j = 0; j < itemCount; j++) {
        const product = products[Math.floor(Math.random() * products.length)];
        const quantity = faker.number.int({ min: 1, max: 3 });
        const subtotal = parseFloat(product.price) * quantity;
        totalAmount += subtotal;

        await OrderItem.create({
          orderId: order.id,
          productId: product.id,
          quantity,
          price: product.price,
          subtotal
        });
      }

      await order.update({ totalAmount });
      orders.push(order);

      if ((i + 1) % 500 === 0) {
        console.log(`Created ${i + 1} orders...`);
      }
    }
    console.log(`Created ${orders.length} orders`);

    console.log('\nDatabase seeded successfully!');
    console.log('\nTest credentials:');
    console.log('Username: testuser');
    console.log('Password: password123');
    console.log('\nAPI is ready at http://localhost:3000');

  } catch (error) {
    console.error('Error seeding database:', error);
    process.exit(1);
  } finally {
    await sequelize.close();
  }
}

// Run seed if executed directly
if (require.main === module) {
  seedDatabase();
}

module.exports = seedDatabase;