const express = require('express');
const path = require('path');
const app = express();
const httpServer = require('http').createServer(app);
var cors = require('cors');
app.use(cors());
const io = require("socket.io")(httpServer, {
    cors: {
        origin: "http://localhost:3000",
        methods: ["GET", "POST"]
    }
});

// SecuroChat bot name
let botName = 'SecuroChat Bot'

// Map users to their room
let users = new Map();

// Map id to username
let id = new Map();

// map rooms to the users inside
let rooms = new Map();

let codeFound = false;
app.get('/:code', (req, res) => {
    if (rooms.has(req.params.code)) {
        codeFound = true;
    }

    if (!rooms.has(req.params.code)) {
        codeFound = false;
    }

    if (codeFound) {
        res.json({ code: req.params.code })
    }

    if (!codeFound) {
        res.json({ code: 'not found' })
    }
})

io.on('connection', (socket) => {

    console.log("made connection")

    socket.on('createRoom', (data) => {
        if (rooms.has(data.code)) {
            socket.emit('roomError')
            console.log('room code already exists.')
        }

        if (!rooms.has(data.code)) {
            if (data.code !== '' && data.user !== '') {
                rooms.set(data.code, [data.user])
                users.set(data.user, data.code);
                socket.join(data.code);
                console.log(rooms, users);
                socket.emit('redirect', `${data.code}`)
            }
            if (data.code === '' || data.user === '') {
                console.log("Username or room code field is empty. Please input.")
            }
        }

    })

    socket.on('joinRoom', (data) => {
        if (rooms.has(data.code)) {
            let arrayOfUsers = rooms.get(data.code);


            if (arrayOfUsers.includes(data.user)) {
                socket.emit('redirect', 'create')
            }

            if (!arrayOfUsers.includes(data.user)) {
                arrayOfUsers.push(data.user);
                rooms.set(data.code, arrayOfUsers);
                console.log(rooms);
            }

            if (!users.has(data.user)) {
                users.set(data.user, data.code);
            }

            socket.join(data.code)
            socket.emit('redirect', `${data.code}`)
        }

        if (!rooms.has(data.code)) {
            socket.emit('redirect', 'create')
        }

    })

    socket.on('connectUser', (username) => {
        if (users.has(username)) {
            socket.join(users.get(username))
            let userFound = false;
            for (let name of id.values()) {
                if (name === username) {
                    userFound = true;
                }
            }
            id.set(socket.id, username);

            if (userFound) {
                socket.emit('message', `${botName}: You've rejoined.`)
            }
            else {
                // Welcome user
                socket.emit('message', `${botName}: Hello, welcome to SecuroChat!`)
                socket.to(users.get(username)).emit("sysMessage", `${username} has joined the chat.`)
            }
        };

        // Redirects to home page if user does not have a room.
        if (!users.has(username)) {
            socket.emit('redirect', 'create')

        }
        if (username === null) {
            socket.emit('redirect', 'join')
        }
    })

    socket.on('disconnect', (reason) => {
        if (id.has(socket.id)) {
            let username = id.get(socket.id)
            let room = users.get(username)
            let userCount = 0;
            let arrayOfUsers = rooms.get(room);
            // If there's multiple id's with the same username then increase the count.
            for (let name of id.values()) {
                if (name === username) {
                    userCount++;
                }
            }

            if (userCount === 1) {
                // Send a message when a user disconnects fully
                socket.emit('redirect', '/')
                socket.leave(users.get(username));
                socket.to(users.get(username)).emit('sysMessage', `${username} has left the chat.`)
                users.delete(username);
                if (arrayOfUsers.includes(username)) {
                    let index = arrayOfUsers.indexOf(username)
                    arrayOfUsers.splice(index, 1);
                    console.log("Room once user leaves.", rooms)
                }

                console.log("users map", users);
            }
            if (arrayOfUsers.length === 0) {
                rooms.delete(room);
                console.log('deleted room', rooms);
            }
            else {
                console.log(arrayOfUsers);
            }

            id.delete(socket.id);
        }

    })


    socket.on('message', (data) => {
        let room = users.get(data.sender);
        io.in(room).emit('chat', (data))
        if (data.message === '') {
            socket.emit('inputMessage')
        }
    })
})

const PORT = process.env.PORT || 5000;
httpServer.listen(PORT, () => console.log(`Server listening on port ${PORT}`))
