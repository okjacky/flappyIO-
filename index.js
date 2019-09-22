'use strict';

const path = require('path');
const pug = require('pug');
const session = require('express-session');
const sharedsession = require("express-socket.io-session");
const express = require('express');
const app = express();
const MongoClient = require('mongodb').MongoClient;
const MongoStore = require('connect-mongo')(session);
const url = process.env.DB_CONN;
const dbName = 'dbBack';
const ObjectId = require('mongodb').ObjectId;

const bodyParser = require('body-parser');
app.use(bodyParser.urlencoded({ extended: false }));

require('dotenv').config();

app.set('view engine', 'pug');
app.use('/src', express.static(__dirname + '/src'));


app.use(session({
    resave: true,
    secret: 's3cr3t',
    saveUninitialized: true,  // don't create session until something stored
    store: new MongoStore({
        url: process.env.DB_CONN
    })

}));
const redirectLogin = (req,res,next)=>{
    if(!req.session.firstname){
        res.redirect('/signin');
    }else{
        next();
    }
}
const redirectJeu = (req,res,next)=>{
    if(req.session.firstname){
        res.redirect('/jeu');
    }else{
        next();
    }
}

let datas = {};
app.use(function (req, res, next) {
    datas = app.locals;
    datas.session = req.session;
    next();
});

app.get('/',redirectJeu, (req, res, next) => {
   //console.log('route //', req.session);
    datas.title = 'Page d\'accueil';
    datas.session = req.session;
    //datas.session.token = req.session.token
    res.render('signin', { datas });
});
app.get('/register', redirectJeu, function (req, res, next) {
    datas.title = 'Page d\'enregistrement';
    res.render('register', { datas });
});
app.get('/signin', redirectJeu,(req, res, next) => {
    datas.title = 'Page de connexion';
    datas.session = req.session;
    res.render('signin', { datas });
});
app.get('/jeu',redirectLogin, (req,res,next)=>{
    datas.title = 'Bienvenue à mon jeu FlappyMultiJeueurs !';
    datas.session = req.session;
    //console.log('pas de session!',datas.session ) 
    res.render('jeu', { datas });
});

app.get('/check', redirectJeu, (req, res, next) => {
    MongoClient.connect(process.env.DB_CONN, { useNewUrlParser: true }, function (err, client) {
        const db = client.db(dbName);
        const collection = db.collection('users');
        if (req.query.email && req.query.pwd) {
            collection.find({
                email: req.query.email,
                password: req.query.pwd
            })
                .toArray((err, docs) => {
                    client.close();
                   // console.log(docs);

                    if (docs.length) {
                        // console.log(docs[0].firstname)
                        req.session.firstname = docs[0].firstname;
                        req.session.ide = docs[0]._id;

                        app.locals.msg = { text: 'Vous êtes connecté !', class: 'success', firstname: docs[0].firstname }
                        res.redirect('/jeu');
                    } else {
                        app.locals.msg = { text: 'Email ou password incorrect, veuillez resaisir !', class: 'danger' };
                        res.redirect('/');
                    }
                });
        }
    });
});

app.post('/register', function (req, res, next) {
    MongoClient.connect(url, { useNewUrlParser: true }, function (err, client) {
        const db = client.db(dbName);
        const collection = db.collection('users');
        if (req.body.firstname && req.body.lastname && req.body.email && req.body.pwd) {
            collection.insert({
                firstname: req.body.firstname,
                lastname: req.body.lastname,
                email: req.body.email,
                password: req.body.pwd,
                date: Date.now()
            }, function (err) {
                req.session.firstname = req.body.firstname;
                //req.session.ide = docs[0]._id;
                app.locals.msg = { text: `Bonjour : ${req.body.firstname}, vous êtes enregistré(e)`, firstname: req.body.firstname, class: 'info' };
                res.redirect('/jeu');
            });
        } else {
            app.locals.msg = { text: 'Veuillez vous enregistrer !', class: 'danger' }
            res.redirect('/signin')
        }
    });
});

app.get('/disconnect', (req, res, next) => {
    req.session.destroy((err) => {
        app.locals.msg = { text: 'Vous êtes déconnectés', class: 'info' };
        res.redirect('/');
    });
});


const port = process.env.PORT || 8181;
let HttpServer = app.listen(port, () => {
    console.log('Connected on ', port)
});

let allFlappys = {};
let users = [];
let connections = [];

const COUNT_DOWN = 4;
let count = COUNT_DOWN;
// registered players
let interval;
let onlinePlayers = {};
let playingPlayers = {};
let gameStarted = false;

/* **************WebSocket.IO************** */
const SocketIo = require('socket.io');
let ioServer = new SocketIo(HttpServer);
// ioServer.use(sharedsession(session({
//     resave: true,
//     secret: 's3cr3t',
//     saveUninitialized: true,  // don't create session until something stored
//     store: new MongoStore({
//         url: 'mongodb+srv://dbjack:Pwd4mydbjack@dbmcloud-93kzh.mongodb.net/dbBack?retryWrites=true&w=majority'
//     })

// })));


ioServer.on('connection', function(socket){
    socket.on('disconnect', () => {  
        delete onlinePlayers[socket.id];
        delete playingPlayers[socket.id];
        //users.slice(users.indexOf(onlinePlayers[socket.id].username, 1));
    });

  

/************************Chat Handle************************/   
    //New User
    socket.on('new user', function(data, callback){
        callback(true);
        onlinePlayers[socket.id] = {
            name: data,
            x: 300,
            y: 300,
            color: "#" + ((1 << 24) * Math.random() | 0).toString(16)
          };

        //users.push(onlinePlayers[socket.id].name);
        updateUsernames(onlinePlayers);
   
    });

    //Send Message
    socket.on('send message', function(data){
        console.log(data);
        ioServer.emit('new message', {msg: data, user: onlinePlayers[socket.id].username});
    });

    function updateUsernames(users){
        ioServer.emit('get users', users);
       
    }

/**************game handle*************/
    
    socket.on('player_ready', () => {
        if (!gameStarted) {
        playingPlayers[socket.id] = onlinePlayers[socket.id];
        playingPlayers[socket.id].name = onlinePlayers[socket.id].name;

        if (Object.keys(playingPlayers).length === Object.keys(onlinePlayers).length 
            && gameStarted === false) {
            // all ready, start count down
            interval = setInterval(countDownTimer, 1000);
        }
        }
    });

    socket.on('position', (data) => {
        let player = onlinePlayers[socket.id] || {};
        player.x = data.x;
        player.y = data.y;
        //console.log('playingPlayers[socket.id].name',playingPlayers[socket.id]);
      });
    
      socket.on('player_dead', () => {
        const player = playingPlayers[socket.id] || {};
        delete playingPlayers[socket.id];
        if (Object.keys(playingPlayers).length === 0) {
          // game finished, all dead
          gameStarted = false;
          transmitWinner(player);
        }
      });
    
});

function startGame() {
    gameStarted = true;
    ioServer.emit('start');
  }
  
  setInterval(() => {
    // create new obstacle
    let minHeight = 20;
    let maxHeight = 200;
    let height = Math.floor(Math.random() * (maxHeight - minHeight + 1) + minHeight);
    let minGap = 50;
    let maxGap = 200;
    let gap = Math.floor(Math.random() * (maxGap - minGap + 1) + minGap);
    

    const obstacle = {
      'height': height,
      'gap': gap
    };
    if (gameStarted) {
        ioServer.emit('obstacle', obstacle);
    }
  }, 2500);
  
  setInterval(() => {
    if (gameStarted) {
      // broadcast all players positions
      ioServer.emit('state', Object.values(playingPlayers));
      //console.log('playingPlayers:', playingPlayers);
    }
  }, 1000 / 60);
  
  function transmitWinner(winner) {
    // broadcast the winner
    ioServer.emit('finish', {
      'name': winner.name,
      'color': winner.color
    });
  }
  
  function countDownTimer() {
    count = count - 1;
    ioServer.emit('count_down', count);
    if (count <= 0) {
      clearInterval(interval);
      count = COUNT_DOWN;
      startGame();
    }
  }
