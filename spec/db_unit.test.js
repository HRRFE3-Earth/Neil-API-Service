//The goal of db_unit.test is to exclude the server and simply determine if the queries to the database are returning the correct results. This will operate under the assumption that the database schema was created correctly. We will be testing for both #1) data was uploaded correctly, and #2) whether the query results are as expected. We will use a test database to ensure no false positive records and also not to modify the actual database. We will not need to connect to the server. The use of the 'beforeEach' is to ensure that we can have a clean database on each test and no results carry forward. The use of the 'beforeEach' is to ensure that we can have a clean database on each test and no results carry forward.

const { Client } = require('pg');
const client = new Client({
  user: 'neildudani',
  database: 'test_reviews_sdc'
})
const queries = require('./../server/queries.js');

beforeAll(() => {
  return new Promise((resolve, reject) => {
    client.connect()
      .then(() => {
        resolve();
      })
  });
});

beforeEach((done) => {
  let sql = `
  DROP TABLE IF EXISTS meta;
CREATE TABLE meta (
  product_id serial PRIMARY KEY,
  ratingOneCount INT DEFAULT 0,
  ratingTwoCount INT DEFAULT 0,
  ratingThreeCount INT DEFAULT 0,
  ratingFourCount INT DEFAULT 0,
  ratingFiveCount INT DEFAULT 0,
  recommendedFalseCount INT DEFAULT 0,
  recommendedTrueCount INT DEFAULT 0
  );

DROP TABLE IF EXISTS reviews;
CREATE TABLE reviews (
    review_id serial PRIMARY KEY,
    product_id INT NOT NULL,
    rating INT,
    date TEXT,
    summary VARCHAR(1000),
    body VARCHAR(1000),
    recommend boolean,
    reported boolean,
    reviewer_name VARCHAR(60),
    reviewer_email VARCHAR(60),
    response VARCHAR,
    helpfulnessCount INT
  );

DROP TABLE IF EXISTS photos;
CREATE TABLE photos (
  photo_id serial PRIMARY KEY,
  review_id INT NOT NULL,
  url TEXT
  );

DROP TABLE IF EXISTS characteristics;
CREATE TABLE characteristics (
  characteristic_id serial PRIMARY KEY,
  product_id INT NOT NULL,
  characteristic VARCHAR(30),
  ratingOneCount INT DEFAULT 0,
  ratingTwoCount INT DEFAULT 0,
  ratingThreeCount INT DEFAULT 0,
  ratingFourCount INT DEFAULT 0,
  ratingFiveCount INT DEFAULT 0
  );

DROP TABLE IF EXISTS characteristic_reviews;
CREATE TABLE characteristic_reviews (
  id serial PRIMARY KEY,
  characteristic_id INT NOT NULL,
  review_id INT NOT NULL,
  rating INT
);

-- LOAD INTO TEST DATABASE DUMMY ENTRIES

INSERT INTO characteristics (product_id, characteristic)
VALUES
  (1, 'Fit'),
  (1, 'Comfort'),
  (1, 'Length'),
  (1, 'Size'),
  (2, 'Fit'),
  (2, 'Colour'),
  (2, 'Size')
;

INSERT INTO reviews (product_id, rating, date, summary, body, recommend, reported, reviewer_name, reviewer_email, response, helpfulnesscount)
VALUES
  (1, 3, '1596080481467', 'SummaryOneA', 'BodyOneA', 'true', 'false', 'Neil', 'Neil@123.com', 'null', 0),
  (1, 4, '1610178433963', 'SummaryOneB', 'BodyOneB', 'false', 'false', 'Fab', 'Fab@456.com', 'null', 0),
  (2, 5, '1594890076276', 'SummaryTwoA', 'BodyTwoA', 'false', 'false', 'Alex', 'Alex@789.com', 'null', 0)
;

INSERT INTO characteristic_reviews (characteristic_id, review_id, rating)
VALUES
  (1, 1, 1),
  (2, 1, 1),
  (3, 1, 1),
  (4, 1, 1),
  (1, 2, 2),
  (2, 2, 2),
  (3, 2, 2),
  (4, 2, 2),
  (5, 3, 3),
  (6, 3, 3),
  (7, 3, 3)
;

UPDATE reviews
  SET date = to_timestamp(reviews.date::numeric/1000);

INSERT INTO meta (product_id) SELECT DISTINCT product_id FROM characteristics;

-- Update Meta

UPDATE meta
SET
  ratingOneCount=subquery.ratingOneCount,
  ratingTwoCount=subquery.ratingTwoCount,
  ratingThreeCount=subquery.ratingThreeCount,
  ratingFourCount=subquery.ratingFourCount,
  ratingFiveCount=subquery.ratingFiveCount,
  recommendedFalseCount=subquery.recommendedFalseCount,
  recommendedTrueCount=subquery.recommendedTrueCount
FROM (
  SELECT
    product_id AS product_id,
    SUM (CASE WHEN r.rating = 1 THEN 1 ELSE 0 END) AS ratingOneCount,
    SUM (CASE WHEN r.rating = 2 THEN 1 ELSE 0 END) AS ratingTwoCount,
    SUM (CASE WHEN r.rating = 3 THEN 1 ELSE 0 END) AS ratingThreeCount,
    SUM (CASE WHEN r.rating = 4 THEN 1 ELSE 0 END) AS ratingFourCount,
    SUM (CASE WHEN r.rating = 5 THEN 1 ELSE 0 END) AS ratingFiveCount,
    SUM (CASE WHEN r.recommend = 'false' THEN 1 ELSE 0 END) AS recommendedFalseCount,
    SUM (CASE WHEN r.recommend = 'true' THEN 1 ELSE 0 END) AS recommendedTrueCount
  FROM
    (SELECT review_id, product_id, rating, recommend FROM reviews) r
  GROUP BY 1
) AS subquery
WHERE meta.product_id = subquery.product_id;

-- Update Characteristics

UPDATE characteristics
SET
  product_id=subquery.product_id,
  ratingOneCount=subquery.ratingOneCount,
  ratingTwoCount=subquery.ratingTwoCount,
  ratingThreeCount=subquery.ratingThreeCount,
  ratingFourCount=subquery.ratingFourCount,
  ratingFiveCount=subquery.ratingFiveCount
FROM (
  SELECT
    ch.characteristic_id as characteristic_id,
    ch.product_id as product_id,
    SUM (CASE WHEN cr.rating = 1 THEN 1 ELSE 0 END) AS ratingOneCount,
    SUM (CASE WHEN cr.rating = 2 THEN 1 ELSE 0 END) AS ratingTwoCount,
    SUM (CASE WHEN cr.rating = 3 THEN 1 ELSE 0 END) AS ratingThreeCount,
    SUM (CASE WHEN cr.rating = 4 THEN 1 ELSE 0 END) AS ratingFourCount,
    SUM (CASE WHEN cr.rating = 5 THEN 1 ELSE 0 END) AS ratingFiveCount
  FROM
    characteristic_reviews cr
  INNER JOIN
    (SELECT characteristic_id, product_id, characteristic FROM characteristics) ch
  ON
    ch.characteristic_id = cr.characteristic_id
  INNER JOIN
    (SELECT review_id FROM reviews) r
  ON
    cr.review_id = r.review_id
  GROUP BY 1,2
) AS subquery
WHERE characteristics.characteristic_id = subquery.characteristic_id;

-- Reset Id For All Tables
SELECT setval('meta_product_id_seq', (SELECT MAX(product_id) FROM meta));
SELECT setval('reviews_review_id_seq', (SELECT MAX(review_id) FROM reviews));
SELECT setval('photos_photo_id_seq', (SELECT MAX(photo_id) FROM photos));
SELECT setval('characteristics_characteristic_id_seq', (SELECT MAX(characteristic_id) FROM characteristics));
SELECT setval('characteristic_reviews_id_seq', (SELECT MAX(id) FROM characteristic_reviews));`;
  client.query(sql)
    .then(() => {
      done();
    })
})


afterAll(() => {
  client.end();
})

describe ('db unit tests', () => {

  it('Testing to see if Jest works', () => {
    expect(1).toBe(1);
  });

  it('should fetch the correct information when sending a query. note the info is based on what was loaded into db in this test', async () => {

    let productId = 1;
    let count = 5;
    let offset = 0;

    let res = await queries.sqlA(productId, count, offset, client);
      expect(res.rows[0].rating).toBe(3);
      expect(res.rows[0].body).toBe('BodyOneA');
      expect(res.rows[1].rating).toBe(4);
      expect(res.rows[1].summary).toBe('SummaryOneB');

  });

});