const LocalStrategy = require('passport-local').Strategy;
const bcrypt = require('bcrypt')


function initialize(passport, getUserByUsername, debug = false) {
    const authenticateUser = async (username, password, done) => {
        if (debug) console.log(`username --> ${username}\n password --> ${password}`);
        const user = await getUserByUsername(username);
        if (debug) console.log(`user --> ${JSON.stringify(user)}`);
        if (user?.errorMessage) {
            return done(null, false, { message: user.errorMessage })
        }
        if (username === null) {
            return done(null, false, { message: 'User not valid' })
        }
        try {
            if (await bcrypt.compare(password, user.password)) {
                return done(null, user);
            } else {
                return done(null, false, { message: 'Incorrect password' })
            }
        } catch (e) {
            return done(e, false);
        }
    }
    passport.use(new LocalStrategy({
        usernameField: 'username',
        passwordField: 'password'
    }, authenticateUser))
    passport.serializeUser((user, done) => done(null, user))
    passport.deserializeUser((user, done) => done(null, user))
}

module.exports = initialize