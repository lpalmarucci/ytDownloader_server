const LocalStrategy = require('passport-local').Strategy;
const bcrypt = require('bcrypt')


function initialize(passport, getUserByUsername, getUserById) {
    const authenticateUser = async (username, password, done) => {
        const user = await getUserByUsername(username);
        if (user?.error) {
            return done(null, false, { message: 'User not found! Please register before signing in' })
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