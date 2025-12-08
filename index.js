const express = require("express");
const cors = require("cors");
const app = express();
require("dotenv").config();
const { MongoClient, ServerApiVersion } = require("mongodb");
const port = process.env.PORT || 3000;

//middleware
app.use(express.json());
app.use(cors());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.buxufwj.mongodb.net/?appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();

    const db = client.db("contest_verse_db");
    const contestsCollection = db.collection("contests");

    // contest api
    // Get all contests
    app.get("/contests", async (req, res) => {
      try {
        const contests = await contestsCollection.find().toArray();
        res.send(contests);
      } catch (error) {
        res.status(500).send({ message: "Failed to fetch contests", error });
      }
    });

    // Popular contests (top 5 by participants)
    app.get("/contests/popular", async (req, res) => {
      try {
        const popular = await contestsCollection
          .find()
          .sort({ participants: -1 })
          .limit(5)
          .toArray();

        res.send(popular);
      } catch (error) {
        res
          .status(500)
          .send({ message: "Failed to fetch popular contests", error });
      }
    });

    // Contest details by ID
    app.get("/contests/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };

      try {
        const contest = await contestsCollection.findOne(query);
        res.send(contest);
      } catch (error) {
        res
          .status(500)
          .send({ message: "Failed to fetch contest details", error });
      }
    });

    app.post("/contests", async (req, res) => {
      const contest = req.body;
      const result = await contestsCollection.insertOne(contest);
      res.send(result);
    });

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("contestverse is contesting!!");
});

app.listen(port, () => {
  console.log(`contestverse is contesting on port ${port}`);
});
