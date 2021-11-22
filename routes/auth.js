const bcrypt = require('bcrypt');

const checkAuth = (req, res, next) => {
    console.log(req.isAuthenticated());
    if (req.isAuthenticated()) {
        const { username } = req.user;
        console.log('testing output')
        console.log(`User ${username} is authenticated`);
        next();
    } else {
        res.json({ status: 401, severity: 'Error', body: { errorMessage: 'Not logged in, please sign in' } })
    }
}

const authenticationRoutes = (app, passport, connection) => {

    app.post('/register', async (req, resp) => {
        const { email, username, password } = req.body;
        const hashedPassword = await bcrypt.hash(password, 10);
        try {
            connection.query(`SELECT COUNT(*) as NUM_RECORDS FROM tUsers WHERE username = '${username}'`, (err, res) => {
                console.log('select err', err);
                console.log('select res', res);

                if (res.length === 0 || res[0].NUM_RECORDS > 0) {
                    resp.json({
                        status: 200,
                        severity: 'Warning',
                        body: {
                            errorMessage: 'User already registered, please log in'
                        }
                    })
                } else {
                    try {

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
                    } catch (e) {
                        console.log('e', e);
                        resp.json({
                            status: 400,
                            severity: 'Warning',
                            body: {
                                errorMessage: 'Username already taken'
                            }
                        })
                    }
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
            if (!user) res.json({ status: 200, body: { errorMessage: info.message, severity: 'Error' } })
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

    app.post('/authenticated', checkAuth, (req, res) => {
        res.json({
            status: 200,
            body: {
                message: 'Authenticated'
            }
        })
    })
}

module.exports = {
    authenticationRoutes,
    checkAuth
};