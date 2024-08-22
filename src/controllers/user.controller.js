import { asyncHandler } from "../utils/asyncHandler.js";
import {ApiError} from "../utils/ApiError.js"
import {User} from "../models/user.model.js"
import {uploadOnCloudinary} from "../utils/cloudinary.js"
import { ApiResponse } from "../utils/ApiResponse.js";

const registerUser = asyncHandler(async (req,res) =>{
    //get user details from frontend
    //validation - not empty
    // check if user already exist : username and email
    //check for images, check for avatar
    //upload them to cloudinary, avatar 
    // create user object - create entry in db
    //remove password and refresh token field from response
    //check for user creation
    // return response

    const {fullname, email, username, password } = req.body
    console.log("email: ", email);
    //console.log(body)

    if(
        [fullname, email, username, password].some((field) => {
            field?.trim() === ""
        })
    ){
        throw new ApiError(400, "* fields are mandatory")
    }

    // add email correct format code

    const existedUser = await User.findOne({
        $or: [{username}, {email}]
    })
    if (existedUser){
        throw new ApiError(409, "User already existed")
    }

    const avatarLocalPath = req.files?.avatar[0]?.path
  
    const coverImageLocalpath = req.files?.coverimage[0]?.path
    //console.log(req.files)

    if(!avatarLocalPath){
        throw new ApiError(400, "Avatar file is required")
    }

    const avatar = await uploadOnCloudinary(avatarLocalPath)

    const coverimage = await uploadOnCloudinary(coverImageLocalpath)
    

    if(!avatar ) {
        throw new ApiError(400, "Avatar file is required")
    }

    const user = await User.create({
        fullname,
        avatar: avatar.url,
        coverimage: coverimage?.url || "",
        email,
        password,
        username: username.toLowerCase()

    })
    const createdUser = await User.findById(user._id).select(
        "-password -refreshToken"
    )

    if(!createdUser){
        throw new ApiError(500, "Something went wronf")
    }

    return res.status(201).json(
        new ApiResponse(200, createdUser, "user registered successfully")
    )

})

export {registerUser,}