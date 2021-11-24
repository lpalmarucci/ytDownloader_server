const express = require("express");
const app = express();
const port = 3001;
const ytdl = require('ytdl-core');
const mysql = require('mysql');
const cors = require('cors');
require('dotenv').config();
const { getFormattedDate } = require('./lib/date');
//***** PASSPORT *****
const session = require('express-session');
const passport = require('passport');
//******************** */
const cookieParser = require("cookie-parser");
const {
    authenticationRoutes,
    checkAuth
} = require('./routes/auth.js');
//----------------------------------------- END OF IMPORTS---------------------------------------------------

//----------------------------------------- MIDDLEWARE ------------------------------------------------------
//To use if the 'Content-Type' header is 'application/json'
app.use(express.json())

//To use if the 'Content-Type' header is 'application/x-www-form-urlencoded'
app.use(express.urlencoded({
    extended: true
}));
app.use(
    cors({
        origin: "http://localhost:3000", // <-- location of the react app were connecting to
        credentials: true,
    })
);
// app.use(flash());
app.use(session({
    secret: 'ajeje-brazorf',
    resave: true,
    saveUninitialized: false,
    cookie: { secure: false }
}));

app.use(cookieParser('ajeje-brazorf'))
// Init passport authentication 
app.use(passport.initialize());
// persistent login sessions 
app.use(passport.session());

const connection = mysql.createConnection({
    host: process.env.DB_HOST,
    user: 'root',
    password: 'rootroot',
    database: process.env.DB_DATABASE
})

connection.connect((connectionError) => {
    if (connectionError) {
        console.error("Error while connecting to the database --> ", connectionError);
        connection.end();
    } else {
        console.log("Connected to database!");
    }
});

//Creating local strategy
require('./passportConfig.js')(passport, (username) => {
    return new Promise((resolve, reject) => {
        connection.query(`
        SELECT *
        FROM tUsers
        WHERE username ='${username}'
    `, (err, res) => {
            console.log(res);
            if (res.length > 0) {
                resolve(res[0])
            } else {
                resolve({ errorMessage: 'User not found' })
            }
        })
    }, (err) => {
        console.log('errore promise ', err);
        reject('Error while fetching info about user');
    })

});

authenticationRoutes(app, passport, connection);

app.post("/download", checkAuth, (req, res) => {
    // const url = req.query.url;
    const { url } = req.body;
    if (!url) {
        res.end({
            status: 400,
            severity: 'Error',
            body: {
                errorMessage: 'Provide a valid URL'
            }
        })
    } else {
        ytdl.getInfo(url).then((info) => {
            const { videoId, likes } = info.videoDetails;
            let { id: authorId, name, user_url, channel_url, subscriber_count } = info.videoDetails.author;
            connection.query(`
                SELECT videoId
                FROM tVideos
                WHERE videoid = '${videoId}'
            `, (err, res, fields) => {
                console.log('response video query', res);
                if (res.length) {
                    videoid = res[0].videoId;
                } else {
                    connection.query(`
                        INSERT INTO tVideos(videoid,url,likes,authorid,updDate) VALUES ('${videoId}','${url}','${likes}','${authorId}','${getFormattedDate(new Date)}')
                    `)
                }
            });

            connection.query(`
                SELECT authorId
                FROM tAuthors
                WHERE authorId = '${authorId}'
            `, (err, authorResponse, fields) => {
                console.log(`err select authors --> ${err}`)
                console.log('author response query ', authorResponse)
                if (authorResponse.length > 0) {
                    authorId = authorResponse[0].authorId;
                } else {
                    connection.query(`
                        INSERT INTO tAuthors(authorid, name, user_url, channel_url, subscriber_count, updDate) VALUES ('${authorId}','${name}','${user_url}','${channel_url}',${subscriber_count},'${getFormattedDate(new Date)}')
                    `)
                }
            })

            res.setHeader('Content-Type', 'video/mp4');
            res.setHeader('Content-Disposition', `attachment; filename="${info.videoDetails.title}.mp4"`);
            let now = new Date().toISOString().slice(0, 19).replace('T', ' ');

            // 171         webm      audio only  DASH audio  115k , audio@128k (44100Hz), 2.59MiB (worst)
            // 140         m4a       audio only  DASH audio  129k , audio@128k (44100Hz), 3.02MiB
            // 141         m4a       audio only  DASH audio  255k , audio@256k (44100Hz), 5.99MiB
            // 160         mp4       256x144     DASH video  111k , 12fps, video only, 2.56MiB
            // 247         webm      1280x720    DASH video 1807k , 1fps, video only, 23.48MiB
            // 136         mp4       1280x720    DASH video 2236k , 24fps, video only, 27.73MiB
            // 248         webm      1920x1080   DASH video 3993k , 1fps, video only, 42.04MiB
            // 137         mp4       1920x1080   DASH video 4141k , 24fps, video only, 60.28MiB
            // 43          webm      640x360
            // 18          mp4       640x360
            // 22          mp4       1280x720    (best)
            try {
                // ytdl.chooseFormat(info.formats, { quality: ['134'] });
                ytdl(url, { quality: '134' }).pipe(res);
                connection.query(`INSERT INTO tDownloads(videoid, user, updDate) VALUES ('${videoId}','${req.user.username}','${now}')`, (err, res, fields) => {
                    // console.log('err insert tDownloads ', err);
                    // console.log('res insert tDownloads ', res);
                    if (err) console.error(err);
                });
            } catch (e) {
                console.log(e);
                res.json({
                    status: 404,
                    severity: 'Warning',
                    body: {
                        errorMessage: 'Video not found!'
                    }
                })
            } finally {
                connection.rollback();
            }
        }).catch((err) => {
            // console.log("error", err);
            res.send({
                status: 404,
                severity: 'Error',
                body: {
                    errorMessage: `No info found for link ${url}`
                }
            });
        });
    }
});

app.listen(port, () => console.log(`Server listening on ${port}`));