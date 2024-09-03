import { asyncHandler } from "../utils/asyncHandler.js";
import {ApiError} from "../utils/ApiError.js"
import {User} from "../models/user.model.js"
import {uploadOnCloudinary} from "../utils/cloudinary.js"
import { ApiResponse } from "../utils/ApiResponse.js";
import jwt from "jsonwebtoken"
import mongoose from "mongoose";


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
            $unset: {
                refreshToken: 1
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

const changeCurrentPassword = asyncHandler(async (req, res) => {

    const {oldPassword, newPassword} = req.body

    const user = await User.findById(req.user?._id)

    const isPasswordCorrect = await user.isPasswordCorrect(oldPassword)

    if(!isPasswordCorrect){
        throw new ApiError(401, "Invalid Password")

        
    }
    user.password = newPassword

    await user.save({validateBeforeSave: false})

    return res.status(200)
    .json(
        new ApiResponse(200, {}, "Password Changed")
    )
})

const getUserDetail = asyncHandler(async(req, res) => {
    const user = await User.findById(req.user?._id)

    if(!user){
        throw new ApiError(401,"User not found")
    }
    return res.status(200)
    .json(
        200,
        user,
        "User found"
    )
})

const updateUserDetail = asyncHandler(async(req, res) => {
        const {fullname, email} = req.body

        if(!fullname || !email) {
            throw new ApiError(400, "* fields are mandatory")
        }

        const user = await User.findByIdAndDelete(req.user?._id, {
            $set:{
                fullname : fullname,
                email: email
            }
            
        },
        {new: true}
    ).select("-password")

    return res.status(200)
    .json(
        new ApiResponse(200, user, "account details updated successfully")
    )
})

const updateUserAvatar = asyncHandler(async (req, res) => {

    const avatarLocalPath = req.file?.path

    if(!avatarLocalPath){
        throw new ApiError(400, "Avatar file missing")
    }
    const avatar = uploadOnCloudinary(avatarLocalPath)

    if(!avatar.url){
        throw new ApiError(401, "Error while uploading avatar")
    }

    const user = await User.findByIdAndUpdate(req.user._id, 
        {
            $set : {
                avatar: avatar.url
            }
        },
        {
            new: true
        }
    ).select("-password")

    return res.status(200)
    .json(
        new ApiResponse(200, "Avatar updated succesfully")
    )
})

const updateUserCoverImage = asyncHandler(async (req, res) => {

    const coverimageLocalPath  = req.file?.path

    if(!coverimageLocalPath){
        throw new ApiError(400, "Coverimage file missing")
    }
    const coverimage = uploadOnCloudinary(coverimageLocalPath)

    if(!coverimage.url){
        throw new ApiError(401, "Error while uploading coverimage")
    }

    const user = await User.findByIdAndUpdate(req.user?._id , 
        {
            $set : {
                coverimage: coverimage.url
            }
        },
        {
            new: true
        }
    ).select("-password")

    return res.status(200)
    .json(
        new ApiResponse(200, user , "Coverimage updated succesfully")
    )
})


const getUserChannelProfile = asyncHandler(async(req, res) => {
    const {username} = req.params 

    if(!username?.trim()){
        throw new ApiError(400, "username is missing")
    }

    const channel = await User.aggregate([
        {
            $match: {
                username: username?.toLowerCase()
            }
        },
        {
            $lookup: {
                from: "subscription",
                localField: "_id",
                foreignField: "channel",
                as: "subscribers"
            }
        },
        {
            $lookup: {
                from: "subscription",
                localField: "_id",
                foreignField: "subscriber",
                as: "subscribedTo"
            }
        },
        {
            $addFields: {
                subscribersCount: {
                    $size: "$subscribers"
                },
                channelsSubscribedToCount: {
                    $size: "$subscribedTo"
                },
                isSubscribed: {
                    $cond: {
                        if: {$in: [req.user?._id, "$subscribers.subscriber"]},
                        then: true,
                        else: false
                    }
                }
            
            }
        },
        {
            $project: {
                fullname: 1,
                username: 1,
                subscribersCount: 1,
                channelsSubscribedToCount: 1,
                isSubscribed: 1,
                avatar: 1,
                coverimage: 1,
                email: 1

            }
        }
        
    ])

    if(!channel?.length){
        throw new ApiError(404, "channel does not exists")
    }

    return res.status(200)
    .json(
        new ApiResponse(200, channel[0], "user channer fetched successfully")
    )
})

const getWatchHistory = asyncHandler(async(req, res) => {
    const user = await User.aggregate([
        {
            $match: {
                _id: new mongoose.Types.ObjectId(req.user._id)

            }
        },
        {
            $lookup: {
                from: "videos",
                localField: "watchHistory",
                foreignField: "_id",
                as: "watchHistory",
                pipeline: [{
                    $lookup: {
                        from: "users",
                        localField: "owner",
                        foreignField: "_id",
                        as: "owner",
                        pipeline: [{
                            $project: {
                                fullname: 1,
                                username: 1,
                                avatar: 1
                            }
                        }
                    ]
                    }
                },
                {
                    $addFields: {
                        owner: {
                            $first: "$owner"
                        }
                    }
                }
            ]
            }
        }
    ])

    return res.status(200)
    .json(
        new ApiResponse(200, user[0].watchHistory, "watch history fetched successfully")
    )
})
 

export {registerUser,loginUser,LogoutUser, refreshAccessToken, changeCurrentPassword, getUserDetail, updateUserDetail, updateUserAvatar, updateUserCoverImage, getUserChannelProfile, getWatchHistory} 