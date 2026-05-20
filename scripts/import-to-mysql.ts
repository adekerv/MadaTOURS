import mysql from 'mysql2/promise';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

async function importData() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error('DATABASE_URL is not set in .env');
    return;
  }

  try {
    const connection = await mysql.createConnection(dbUrl);
    console.log('Connected to database.');

    const placesPath = path.join(process.cwd(), 'src', 'data', 'places.json');
    const places = JSON.parse(fs.readFileSync(placesPath, 'utf8'));

    for (const place of places) {
      console.log(`Importing ${place.name}...`);
      await connection.execute(
        `INSERT INTO places (id, name, type, lat, lng, location, description, rating, hours, tags, image) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE 
         name=VALUES(name), type=VALUES(type), lat=VALUES(lat), lng=VALUES(lng), 
         location=VALUES(location), description=VALUES(description), rating=VALUES(rating), 
         hours=VALUES(hours), tags=VALUES(tags), image=VALUES(image)`,
        [
          place.id,
          place.name,
          place.type,
          place.lat,
          place.lng,
          place.location,
          place.description,
          place.rating,
          place.hours,
          JSON.stringify(place.tags),
          place.image
        ]
      );
    }

    console.log('Data import complete.');
    await connection.end();
  } catch (error) {
    console.error('Import failed:', error);
  }
}

importData();
