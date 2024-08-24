import mongoose, {Schema} from "mongoose";

const subscriptionSchema = new Schema ({

    subcriber: {
        type: Schema.Types.ObjectId, // one who is subscribing
        ref: "User"
    },
    channel: {
        type: Schema.Types.ObjectId, // one to who subscriber is subscribing
        ref: "User"
    }

}, {timestamps: true})

export const  SubscriptionSchema = mongoose.model("Subscription", subscriptionSchemaubscriptionSchema)