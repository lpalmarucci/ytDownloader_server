const express = require("express");
const app = express();
const port = 3001;
const ytdl = require('ytdl-core');
const mysql = require('mysql');
const cors = require('cors');
require('dotenv').config();
const { getFormattedDate } = require('./lib/date');
//***** PASSPORT *****
const bcrypt = require('bcrypt');
const session = require('express-session');
const passport = require('passport');
//******************** */
const cookieParser = require("cookie-parser");
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
    secret: '1234',
    resave: true,
    saveUninitialized: false,
    cookie: { secure: false }
}));

app.use(cookieParser('1234'))
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

const checkAuth = (req, res, next) => {
    if (req.isAuthenticated()) {
        console.log('User is authenticated');
        next();
    } else {
        res.json({ status: 401 })
    }
}

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
                resolve({ error: 'User not found' })
            }
        })
    }, (err) => {
        console.log('errore promise ', err);
        reject('Error while fetching info about user');
    })

}, (user_id) => {
    return new Promise((resolve, reject) => {
        try {
            connection.query(`SELECT * FROM tUsers WHERE user_id = '${user_id}'`, (err, res) => {
                if (res.length > 0) {
                    resolve(res[0])
                } else {
                    reject(err);
                }
            })
        } catch (e) {
            reject(e);
        }
    })
});

app.post('/register', async (req, resp) => {
    const { email, username, password } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);
    try {
        connection.query(`SELECT COUNT(*) as NUM_RECORDS FROM tUsers WHERE username = '${username}'`, (err, res) => {
            if (res.length === 0 || res[0].NUM_RECORDS > 0) {
                resp.json({
                    status: 200,
                    severity: 'Warning',
                    body: {
                        errorMessage: 'User already registered, please log in'
                    }
                })
            } else {
                connection.query(`INSERT INTO tUsers (email,username, password) VALUES('${email}','${username}','${hashedPassword}')`, (err, res) => {
                    console.log('error insert user--> ', err)
                    console.log('result insert user', res);
                    if (res.affectedRows === 1) {
                        resp.json({
                            status: 200,
                            severity: 'no-error',
                            body: {
                                message: 'Registration completed'
                            }
                        })
                    } else {
                        resp.json({
                            status: 200,
                            severity: 'Error',
                            body: {
                                errorMessage: 'Unable to complete registration'
                            }
                        })
                    }
                })
            }
        });
    } catch (e) {
        resp.json({
            status: 200,
            severity: 'Error',
            body: {
                errorMessage: e
            }
        })
    }
})

app.post("/login", (req, res, next) => {
    passport.authenticate("local", (err, user, info) => {
        console.log(`user --> ${user}`);
        console.log(`info --> ${info}`);
        if (info) res.json({ status: 200, severity: 'Error', body: { errorMessage: info.message } });
        if (!user) res.json({ status: 200, body: { errorMessage: 'Please verify your credentials' } })
        else {
            req.logIn(user, (err) => {
                if (err) res.json({ status: 200, body: { message: err } })
                res.json({
                    status: 200,
                    severity: 'no-error',
                    body: {
                        message: 'Authenticated'
                    }
                })
                console.log(req.user)
            });
        }
    })(req, res, next);
});

//FOR TESTING
// app.post('/authenticated', (req, res) => {
//     passport.authenticate('local', (err, info, fields) => {
//         console.log(info);
//         res.json({ message: 'OK' })
//     })
// })

app.post("/download", checkAuth, (req, res) => {
    // const url = req.query.url;
    const { url } = req.body;
    if (!url) {
        res.end({
            status: 400,
            severity: 'Error',
            body: {
                msg: 'Check either the username or the url'
            }
        })
    } else {
        ytdl.getInfo(url).then((info) => {
            console.log('info', info);
            const { videoId, likes } = info.videoDetails;
            const { id: authorId, name, user_url, channel_url, subscriber_count } = info.videoDetails.author;
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
                console.log('author response query ', authorResponse)
                if (res.length) {
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
                console.log(info.videoDetails.videoId);
                ytdl(url, { quality: [137], filter: format => format.container === 'mp4' }).pipe(res);
                connection.query(`INSERT INTO tDownloads(videoid, user, updDate) VALUES ('${videoId}','${user}','${now}')`, (err, res, fields) => {
                    console.log(fields);
                    if (err) console.error(err);
                });
            } catch (e) {
                console.log(e);
                res.json({
                    status: 404,
                    severity: 'Warning',
                    body: {
                        msg: 'Video not found!'
                    }
                })
            }
        }).catch((err) => {
            console.log("error", err);
            res.send({
                error: {
                    code: 404,
                    message: `No info found for link ${url}`
                }
            });
        });
    }
});

app.listen(port, () => console.log(`Server listening on ${port}`));