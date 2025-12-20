const express = require("express");
const cors = require("cors");
const app = express();
require("dotenv").config();
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const stripe = require("stripe")(process.env.STRIPE_SECRET);
const port = process.env.PORT || 3000;

const admin = require("firebase-admin");
const serviceAccount = require("./contestverse-e1972-firebase-adminsdk-fbsvc-a2b0dc62b9.json");
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

// utils/generateTrackingId.js
const crypto = require("crypto");
function generateTrackingId() {
  const prefix = "PRCL";
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const rand = crypto.randomBytes(3).toString("hex").toUpperCase();
  return `${prefix}-${date}-${rand}`;
}

//middleware
app.use(express.json());
app.use(cors());

const verifyToken = async (req, res, next) => {
  const token = req.headers.authorization;

  if (!token) {
    return res.status(401).send({ message: "unauthorized" });
  }

  try {
    const idToken = token.split(" ")[1];
    const decoded = await admin.auth().verifyIdToken(idToken);
    console.log("decoded in the token", decoded);
    req.decoded_email = decoded.email;
    next();
  } catch (err) {
    return res.status(403).send({ message: "invalid token" });
  }
};

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
    const usersCollection = db.collection("users");
    const contestsCollection = db.collection("contests");
    const paymentCollection = db.collection("payments");
    const creatorsCollection = db.collection("creators");
    const submissionsCollection = db.collection("submissions");

    // verify admin route
    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded_email;
      const query = { email };
      const user = await usersCollection.findOne(query);

      if (!user || user.role !== "admin") {
        return res.status(403).send({ message: "forbidden access" });
      }
      next();
    };

    // user related api
    app.post("/users", async (req, res) => {
      const user = req.body;
      user.role = "user";
      user.createdAt = new Date();
      const email = user.email;
      const userExists = await usersCollection.findOne({ email });

      if (userExists) {
        return res.send({ message: "user already exist" });
      }
      const result = await usersCollection.insertOne(user);
      res.send(result);
    });

    app.get("/users", verifyToken, async (req, res) => {
      // const query = {}
      const cursor = usersCollection.find();
      const result = await cursor.toArray();
      res.send(result);
    });

    app.get("/users/:email/role", verifyToken, async (req, res) => {
      const email = req.params.email;
      const query = { email };
      const user = await usersCollection.findOne(query);
      res.send({ role: user?.role || "user" });
    });

    app.patch("/users/:id/role", verifyToken, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const roleInfo = req.body;
      const query = { _id: new ObjectId(id) };
      const updatedDoc = {
        $set: {
          role: roleInfo.role,
        },
      };
      const result = await usersCollection.updateOne(query, updatedDoc);
      res.send(result);
    });

    // Get logged-in user profile (Add this to your server.js)
    app.get("/users/profile", verifyToken, async (req, res) => {
      const email = req.decoded_email;
      const query = { email: email };
      const user = await usersCollection.findOne(query);
      res.send(user);
    });

    // Update Profile
    app.patch("/users/profile", verifyToken, async (req, res) => {
      const email = req.decoded_email;
      const { displayName, photoURL, bio } = req.body;

      const filter = { email: email };
      const updateDoc = {
        $set: {
          displayName,
          photoURL,
          bio,
          updatedAt: new Date(),
        },
      };
      const result = await usersCollection.updateOne(filter, updateDoc);
      res.send(result);
    });

    // contest api
    app.get("/contests", async (req, res) => {
      try {
        const query = {};
        const { email } = req.query;
        if (email) {
          query.creatorEmail = email;
        }

        const contests = await contestsCollection.find(query);
        const result = await contests.toArray();
        res.send(result);
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
    app.get("/contest-details/:id", async (req, res) => {
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

    // app.get("/my-participated-contests", verifyToken, async (req, res) => {
    //   const email = req.decoded_email;

    //   const payments = await paymentCollection
    //     .find({ userEmail: email })
    //     .toArray();

    //   const result = await Promise.all(
    //     payments.map(async (pay) => {
    //       const contest = await contestsCollection.findOne({
    //         _id: new ObjectId(pay.contestId),
    //       });

    //       const submission = await submissionsCollection.findOne({
    //         contestId: pay.contestId,
    //         userEmail: email,
    //       });

    //       return {
    //         ...pay,
    //         deadline: contest?.deadline,
    //         isSubmitted: !!submission,
    //       };
    //     })
    //   );

    //   res.send(result);
    // });

    app.get("/my-participated-contests", verifyToken, async (req, res) => {
      const email = req.decoded_email;

      try {
        const payments = await paymentCollection
          .find({ userEmail: email })
          .toArray();

        const result = await Promise.all(
          payments.map(async (pay) => {
            // ✅ safe ObjectId check
            let contest = null;
            try {
              if (pay.contestId && ObjectId.isValid(pay.contestId)) {
                contest = await contestsCollection.findOne({
                  _id: new ObjectId(pay.contestId),
                });
              }
            } catch (err) {
              contest = null;
            }

            // ✅ check if user already submitted
            const submission = await submissionsCollection.findOne({
              contestId: pay.contestId,
              userEmail: email,
            });

            return {
              ...pay,
              deadline: contest ? contest.deadline : null,
              isSubmitted: submission ? true : false, // 🔥 used in frontend to hide submit btn
            };
          })
        );

        res.send(result);
      } catch (error) {
        console.error("Error fetching participated contests:", error);
        res.status(500).send({ message: "Failed to fetch contests", error });
      }
    });

    // get single contest data by id
    app.get("/contests/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await contestsCollection.findOne(query);
      res.send(result);
    });

    // update contest by admin
    app.patch("/contests/:id", verifyToken, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const { status } = req.body;

      const query = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          approvalStatus: status,
        },
      };

      const result = await contestsCollection.updateOne(query, updateDoc);
      res.send(result);
    });

    // UPDATE contest (only pending & own)
    app.patch("/creator/contests/:id", verifyToken, async (req, res) => {
      const { id } = req.params;
      const updatedData = req.body;
      const email = req.decoded_email;

      const result = await contestsCollection.updateOne(
        {
          _id: new ObjectId(id),
          creatorEmail: email,
          approvalStatus: "pending",
        },
        {
          $set: {
            ...updatedData,
            updatedAt: new Date(),
          },
        }
      );

      if (result.matchedCount === 0) {
        return res.status(403).send({
          message: "You cannot edit this contest",
        });
      }

      res.send(result);
    });

    // contest delete api
    app.delete("/contests/:id", verifyToken, async (req, res) => {
      const id = req.params.id;
      const email = req.decoded_email;

      const contest = await contestsCollection.findOne({
        _id: new ObjectId(id),
      });

      if (!contest) {
        return res.status(404).send({ message: "Contest not found" });
      }

      if (contest.creatorEmail !== email) {
        return res.status(403).send({ message: "Forbidden" });
      }

      if (contest.approvalStatus !== "pending") {
        return res
          .status(400)
          .send({ message: "Only pending contests can be deleted" });
      }

      const result = await contestsCollection.deleteOne({
        _id: new ObjectId(id),
      });

      res.send(result);
    });

    app.post("/contests", async (req, res) => {
      const contest = req.body;
      const result = await contestsCollection.insertOne(contest);
      res.send(result);
    });

    // PAYENT related api
    app.post("/create-checkout-session", verifyToken, async (req, res) => {
      const paymentInfo = req.body;
      const amount = parseInt(paymentInfo.price) * 100;

      const session = await stripe.checkout.sessions.create({
        line_items: [
          {
            price_data: {
              currency: "USD",
              unit_amount: amount,
              product_data: {
                name: paymentInfo.contestName,
              },
            },
            quantity: 1,
          },
        ],
        customer_email: req.decoded_email,

        mode: "payment",

        metadata: {
          contestId: paymentInfo.contestId,
          contestName: paymentInfo.contestName,
        },
        success_url: `${process.env.SITE_DOMAIN}/dashboard/payment-success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${process.env.SITE_DOMAIN}/dashboard/payment-cancelled`,
      });
      res.send({ url: session.url });
    });

    // app.patch("/payment-success", async (req, res) => {
    //   const sessionId = req.query.session_id;
    //   const session = await stripe.checkout.sessions.retrieve(sessionId);
    //   console.log(session);

    //   // verify already payment
    //   const transactionId = session.payment_intent;

    //   const query = { transactionId: transactionId };
    //   const paymentExist = await paymentCollection.findOne(query);
    //   if (paymentExist) {
    //     return res.send({
    //       message: "already added",
    //       transactionId,
    //       trackingId: paymentExist.trackingId,
    //     });
    //   }

    //   const trackingId = generateTrackingId();

    //   if (session.payment_status === "paid") {
    //     const id = session.metadata.contestId;
    //     const query = { _id: new ObjectId(id) };

    //     // const update = {
    //     //   $set: {
    //     //     paymentStatus: "paid",
    //     //     trackingID: trackingId,
    //     //   },
    //     // };

    //     // const result = await contestsCollection.updateOne(query, update);

    //     const payment = {
    //       amount: session.amount_total / 100,
    //       currency: session.currency,
    //       userEmail: session.customer_email,
    //       contestId: session.metadata.contestId,
    //       contestName: session.metadata.contestName,
    //       transactionId: session.payment_intent,
    //       paymentStatus: session.payment_status,
    //       paidAt: new Date(),
    //       trackingId: trackingId,
    //     };

    //     if (session.payment_status === "paid") {
    //       const resultPayment = await paymentCollection.insertOne(payment);
    //       res.send({
    //         success: true,
    //         // modifyContest: result,
    //         trackingId: trackingId,
    //         transactionId: session.payment_intent,
    //         paymentInfo: resultPayment,
    //       });
    //     }
    //     // increase participants count
    //     await contestsCollection.updateOne(
    //       { _id: new ObjectId(session.metadata.contestId) },
    //       { $inc: { participants: 1 } }
    //     );
    //   }
    //   res.send({ success: false });
    // });

    app.patch("/payment-success", async (req, res) => {
      try {
        const sessionId = req.query.session_id;
        const session = await stripe.checkout.sessions.retrieve(sessionId);

        const transactionId = session.payment_intent;

        const paymentExist = await paymentCollection.findOne({ transactionId });
        if (paymentExist) {
          return res.send({
            success: true,
            message: "Already processed",
            trackingId: paymentExist.trackingId,
          });
        }

        if (session.payment_status === "paid") {
          const trackingId = generateTrackingId();

          const payment = {
            amount: session.amount_total / 100,
            currency: session.currency,
            userEmail: session.customer_email,
            contestId: session.metadata.contestId,
            contestName: session.metadata.contestName,
            transactionId: transactionId,
            paymentStatus: session.payment_status,
            paidAt: new Date(),
            trackingId: trackingId,
          };

          const resultPayment = await paymentCollection.insertOne(payment);

          await contestsCollection.updateOne(
            { _id: new ObjectId(session.metadata.contestId) },
            { $inc: { participants: 1 } }
          );

          return res.send({
            success: true,
            trackingId: trackingId,
            transactionId: transactionId,
            paymentInfo: resultPayment,
          });
        }

        res.status(400).send({ success: false, message: "Payment not paid" });
      } catch (error) {
        console.error(error);
        res
          .status(500)
          .send({ success: false, message: "Internal Server Error" });
      }
    });

    // payment related api
    app.get("/payments", verifyToken, async (req, res) => {
      const email = req.query.email;
      const query = {};

      // console.log(req.headers);

      if (email) {
        query.userEmail = email;

        if (email !== req.decoded_email) {
          return res.status(403).send({ message: "forbidden access" });
        }
      }
      const cursor = paymentCollection.find(query);
      const result = await cursor.toArray();
      res.send(result);
    });

    // creator related api
    app.get("/creators", async (req, res) => {
      const query = {};
      if (req.query.status) {
        query.status = req.query.status;
      }
      const cursor = creatorsCollection.find(query);
      const result = await cursor.toArray();
      res.send(result);
    });

    app.post("/creators", async (req, res) => {
      const creator = req.body;
      creator.status = "pending";
      creator.createdAt = new Date();
      const result = await creatorsCollection.insertOne(creator);
      res.send(result);
    });

    app.patch("/creators/:id", verifyToken, async (req, res) => {
      const status = req.body.status;
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const updatedDoc = {
        $set: {
          status: status,
        },
      };
      const result = await creatorsCollection.updateOne(query, updatedDoc);

      // set role
      if (status === "approved") {
        const email = req.body.email;
        const userQuery = { email };
        const updateUser = {
          $set: {
            role: "creator",
          },
        };
        const creatorResult = await usersCollection.updateOne(
          userQuery,
          updateUser
        );
      }

      res.send(result);
    });

    // submissions post api
    app.post("/submissions", verifyToken, async (req, res) => {
      try {
        const { contestId, contestName, submissionText } = req.body;
        const userEmail = req.decoded_email;

        if (!contestId || !submissionText) {
          return res.status(400).send({ message: "Missing required fields" });
        }

        // get user info
        const user = await usersCollection.findOne({ email: userEmail });
        if (!user) {
          return res.status(404).send({ message: "User not found" });
        }

        // prevent duplicate submission
        const alreadySubmitted = await submissionsCollection.findOne({
          contestId,
          userEmail,
        });

        if (alreadySubmitted) {
          return res.status(400).send({
            message: "You have already submitted this contest",
          });
        }

        const submissionDoc = {
          contestId,
          contestName,
          userId: user._id,
          userName: user.displayName,
          userEmail,
          submissionText,
          submittedAt: new Date(),
          status: "pending",
        };

        const result = await submissionsCollection.insertOne(submissionDoc);

        res.send({
          success: true,
          message: "Submission successful",
          insertedId: result.insertedId,
        });
      } catch (error) {
        console.error("Submission Error:", error);
        res.status(500).send({
          message: "Submission failed",
          error,
        });
      }
    });

    app.get(
      "/submissions/contest/:contestId",
      verifyToken,
      async (req, res) => {
        const { contestId } = req.params;
        const creatorEmail = req.decoded_email;

        // 1. Find the contest
        const contest = await contestsCollection.findOne({
          _id: new ObjectId(contestId),
          creatorEmail: creatorEmail,
        });

        if (!contest)
          return res.status(404).send({ message: "Contest not found" });

        // 2. Only creator can see submissions
        if (contest.creatorEmail !== creatorEmail) {
          return res.status(403).send({ message: "Forbidden" });
        }

        // 3. Get all submissions for this contest
        const submissions = await submissionsCollection
          .find({ contestId: contestId }) // match string
          .sort({ submittedAt: -1 })
          .toArray();

        res.send(submissions);
      }
    );

    app.patch(
      "/submissions/declare-winner/:submissionId",
      verifyToken,
      async (req, res) => {
        const { submissionId } = req.params;
        const creatorEmail = req.decoded_email;

        try {
          const submission = await submissionsCollection.findOne({
            _id: new ObjectId(submissionId),
          });

          if (!submission) {
            return res.status(404).send({ message: "Submission not found" });
          }

          const contest = await contestsCollection.findOne({
            _id: new ObjectId(submission.contestId),
            creatorEmail: creatorEmail,
          });

          if (!contest) {
            return res
              .status(404)
              .send({ message: "Contest not found or unauthorized" });
          }

          if (contest.winnerEmail) {
            return res
              .status(400)
              .send({ message: "Winner already declared for this contest" });
          }

          await submissionsCollection.updateOne(
            { _id: new ObjectId(submissionId) },
            { $set: { status: "winner" } }
          );

          const result = await contestsCollection.updateOne(
            { _id: new ObjectId(submission.contestId) },
            {
              $set: {
                winnerName: submission.userName,
                winnerEmail: submission.userEmail,
                winnerImage: submission.userImage || "",
                status: "completed",
              },
            }
          );

          res.send({ success: true, result });
        } catch (error) {
          res
            .status(500)
            .send({ message: "Server error", error: error.message });
        }
      }
    );

    // 1. My Winning Contests (For User Dashboard)
    app.get("/submissions/my-wins/:email", verifyToken, async (req, res) => {
      const email = req.params.email;
      const result = await submissionsCollection
        .find({
          userEmail: email,
          status: "winner",
        })
        .toArray();
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
