import express, { json } from "express";
import cors from "cors";
import { MongoClient } from "mongodb";
import dotenv from "dotenv";
import joi from "joi";
import dayjs from "dayjs";

const participantsSchema = joi.object({
  name: joi.string().required(),
});

const messagesSchema = joi.object({
  to: joi.string().required(),
  text: joi.string().required(),
  type: joi.string().valid("message", "private_message").required(),
});

const app = express();

app.use(cors());
app.use(express.json());
dotenv.config();

const mongoClient = new MongoClient(process.env.MONGO_URI);

try {
  await mongoClient.connect();
  console.log("Connected with Mongodb");
} catch (err) {
  console.log(err);
}

const db = mongoClient.db("projeto13-batepapo-uol-api");
const collectionParticipants = db.collection("participants");
const collectionMessages = db.collection("messages");

app.post("/participants", async (req, res) => {
  const { name } = req.body;
  const participant = {
    name,
    lastStatus: Date.now(),
  };
  const day = dayjs().format("HH:mm:ss");
  const welcomeMessage = {
    from: name,
    to: "Todos",
    text: "entra na sala...",
    type: "status",
    time: day,
  };

  try {
    const { error } = participantsSchema.validate(req.body, {
      abortEarly: false,
    });

    if (error) {
      const errors = error.details.map((d) => d.message);
      res.status(422).send(errors);
      return;
    }

    const participantExists = await collectionParticipants.findOne({
      name: name,
    });
    if (participantExists) {
      res.status(409).send({ message: "Esse participante já existe!" });
      return;
    }

    await collectionMessages.insertOne(welcomeMessage);
    await collectionParticipants.insertOne(participant);
    res.sendStatus(201);
  } catch (err) {
    console.log(err);
    res.sendStatus(500);
  }
});

app.get("/participants", async (req, res) => {
  try {
    const participants = await collectionParticipants.find().toArray();
    res.send(participants);
  } catch (err) {
    console.log(err);
    res.sendStatus(500);
  }
});

app.post("/messages", async (req, res) => {
  const { to, text, type } = req.body;
  const { user } = req.headers;
  const day = dayjs().format("HH:mm:ss");
  const messageCreated = {
    from: user,
    to,
    text,
    type,
    time: day,
  };

  try {
    const { error } = messagesSchema.validate(req.body, {
      abortEarly: false,
    });

    if (error) {
      const errors = error.details.map((d) => d.message);
      res.status(422).send(errors);
      return;
    }
    const participantExists = await collectionParticipants.findOne({
      name: user,
    });
    if (!participantExists) {
      res.status(422).send({ message: "Esse participante não existe!" });
      return;
    }

    await collectionMessages.insertOne(messageCreated);
    res.sendStatus(201);
  } catch (err) {
    console.log(err);
    res.sendStatus(500);
  }
});

app.get("/messages", async (req, res) => {
  const { limit } = req.query;
  const { user } = req.headers;

  try {
    let messages = [];
    if (limit) {
      messages = await collectionMessages
        .find({}, { sort: { time: -1 }, limit: parseInt(limit) })
        .toArray();
    } else {
      messages = await collectionMessages
        .find({}, { sort: { time: -1 } })
        .toArray();
    }
    messages = messages.filter(
      (m) => m.from === user || m.to === user || m.to === "Todos"
    );
    res.send(messages);
  } catch (err) {
    console.log(err);
    res.sendStatus(500);
  }
});

app.post("/status", async (req, res) => {
  const { user } = req.headers;

  try {
    const participantExists = await collectionParticipants.findOne({
      name: user,
    });
    if (!participantExists) {
      res.sendStatus(404);
      return;
    }

    await collectionParticipants.updateOne(
      {
        name: user,
      },
      {
        $set: {
          lastStatus: Date.now(),
        },
      }
    );
    res.sendStatus(200);
  } catch (err) {
    console.log(err);
    res.sendStatus(500);
  }
});

setInterval(async () => {
  const day = dayjs().format("HH:mm:ss");
  const participantsAFK = await collectionParticipants
    .find({
      lastStatus: { $lt: Date.now() - 10000 },
    })
    .toArray();
  participantsAFK.forEach((p) => {
    collectionMessages.insertOne({
      from: p.name,
      to: "Todos",
      text: "sai da sala...",
      type: "status",
      time: day,
    });
  });
  await collectionParticipants.deleteMany({
    lastStatus: { $lt: Date.now() - 10000 },
  });
}, 15000);

app.listen(process.env.PORT, () =>
  console.log(`Server running in port: ${process.env.PORT}`)
);
