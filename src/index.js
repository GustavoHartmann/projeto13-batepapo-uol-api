import express, { json } from "express";
import cors from "cors";
import { MongoClient } from "mongodb";
import dotenv from "dotenv";
import joi from "joi";
import dayjs from "dayjs";

const participantsSchema = joi.object({
  name: joi.string().required(),
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

app.listen(process.env.PORT, () =>
  console.log(`Server running in port: ${process.env.PORT}`)
);
