//require('dotenv').config()
import {app} from "./app.js"
import dotenv from "dotenv"
dotenv.config()
import connectDB from "./db/index.js";




connectDB()
.then(() =>{
    app.listen(process.env.PORT || 8000, () =>{
        console.log(`Server is running at port: ${process.env.PORT}`);
        
    })
})
.catch((err) =>{
    console.log("Mongo DB connection failed!!", err);
    
})

/*

( async () => {
    try{
        await mongoose.connect(`${process.env.MONGODB_URI}/${DB_NAME}`)
        app.on("error",(error) => {
            console.log(("Error: ",error));
            throw error
        })

        app.listen(process.env.PORT, () => {
            console.log(`App is listening on ${process.env.PORT}`)
        })
    }catch(error){
        console.log("ERROR:", error)
        throw error
    }
})()

*/