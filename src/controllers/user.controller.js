import { asyncHandler } from "../utils/asyncHandler.js";
import {ApiError} from "../utils/ApiError.js"
import {User} from "../models/user.model.js"
import {uploadOnCloudinary} from "../utils/cloudinary.js"
import { ApiResponse } from "../utils/ApiResponse.js";
import jwt from "jsonwebtoken"


const generateAccessAndRefreshTokens = async (userId) => {
    try {
       const user =  await User.findById(userId)
       
       const accessToken = user.generateAccessToken()
       const refreshToken = user.generateRefreshToken()
       
       user.refreshToken = refreshToken
       await user.save({validateBeforeSave: false})

       return {accessToken, refreshToken}

    } catch (error) {
        throw new ApiError(500, error.message)
    }
}

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

const loginUser = asyncHandler(async (req, res) => {
    //get email and password from user
    //throw err if they are not given
    //find user
    //compare password
    //if wrong, pass message
    //if right, generate token
    //access and refresh token
    //send cookies
    console.log("req.body: ", req.body)
    const {email, username, password } = req.body
    console.log("email: ", email);

    if(!email){
        throw new ApiError(400, " email is required")
    }


    const user = await User.findOne({
        $or: [{username}, {email}]
    })
    
    if(!user){
        throw new ApiError(400, "USer not exist")
    }

    const isPasswordValid = await user.isPasswordCorrect(password)

    if(!isPasswordValid){
        throw new ApiError(404, "password incorrect, invalid credentials")
    }

    const{accessToken, refreshToken} = await generateAccessAndRefreshTokens(user._id)

    const LoggedInUser = await User.findById(user._id).select("-password -refreshToken")

    const options = {
        httpOnly: true,
        secure: true
    }
    return res
    .status(200).cookie("accessToken", accessToken, options)
    .cookie("refreshToken", refreshToken, options)
    .json(
        new ApiResponse(200, 
            {
            user: LoggedInUser, accessToken, refreshToken

            },
            "User logged in successfully"
    )
    )
})

const LogoutUser = asyncHandler(async (req, res) => {

    await User.findByIdAndUpdate(
        req.user._id,
        {
            $set: {
                refreshToken: undefined
            }
        },
        {
            new: true
        }
    )

    const options = {
        httpOnly: true,
        secure: true
    }

    return res
    .status(200)
    .clearCookie("accessToken", options)
    .clearCookie("refreshToken", options)
    .json(
        new ApiResponse(200, {}, "User logged out ")
    )
})

const refreshAccessToken = asyncHandler(async (req, res) => {
    const incomingRefreshToken = req.cookies.refreshToken || req.body.refreshToken

    if(!incomingRefreshToken){
        throw new ApiError(401, "Unauthorized request")
    }

    try {
        const decodedToken = await jwt.verify(incomingRefreshToken, process.env.REFRESH_TOKEN_SECRET)
    
        const user = await User.findById(decodedToken?._id)
    
        if(!user){
            throw new ApiError(401, "Invalid Refresh token")
        }
    
        if(incomingRefreshToken !== user?.refreshToken){
            throw new ApiError(401, "Refresh token is expired or used")
        }
    
        const options = {
            httpOnly: true,
            secure: true
        }
    
        const {accessToken, newrefreshToken} = await generateAccessAndRefreshTokens(user._id)
    
        return res
        .status(200)
        .cookie("accessToken",accessToken, options)
        .cookie("refreshToken", newrefreshToken, options)
        .json(
            new ApiResponse(
                200,
                {accessToken, refreshToken: newrefreshToken},
                "Access token refreshed"
            )
        )
    } catch (error) {
        throw new ApiError(401, error.message || "invalid refresh token")
    }

})

export {registerUser,loginUser,LogoutUser, refreshAccessToken} 