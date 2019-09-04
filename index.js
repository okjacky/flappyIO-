'use strict';

const path = require('path');
const pug = require('pug');
const session = require('express-session');
const sharedsession = require("express-socket.io-session");
const express = require('express');
const app = express();
const MongoClient = require('mongodb').MongoClient;
const MongoStore = require('connect-mongo')(session);
const url = 'mongodb+srv://dbjack:Pwd4mydbjack@dbmcloud-93kzh.mongodb.net/dbBack?retryWrites=true&w=majority';
const dbName = 'dbBack';
const ObjectId = require('mongodb').ObjectId;

const bodyParser = require('body-parser');
app.use(bodyParser.urlencoded({ extended: false }));



app.set('view engine', 'pug');
app.use('/src', express.static(__dirname + '/src'));


app.use(session({
    resave: true,
    secret: 's3cr3t',
    saveUninitialized: true,  // don't create session until something stored
    store: new MongoStore({
        url: 'mongodb+srv://dbjack:Pwd4mydbjack@dbmcloud-93kzh.mongodb.net/dbBack?retryWrites=true&w=majority'
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
    console.log('pas de session!',datas.session ) 
    res.render('jeu', { datas });
});

app.get('/check', redirectJeu, (req, res, next) => {
    MongoClient.connect(url, { useNewUrlParser: true }, function (err, client) {
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


const port = process.env.PORT || 8080;
let HttpServer = app.listen(port, () => {
    console.log('Connected on ', port)
});

let allFlappys = {};
let users = [];
let connections = [];

/* **************WebSocket.IO************** */
const SocketIo = require('socket.io');
let ioServer = new SocketIo(HttpServer);
ioServer.use(sharedsession(session({
    resave: true,
    secret: 's3cr3t',
    saveUninitialized: true,  // don't create session until something stored
    store: new MongoStore({
        url: 'mongodb+srv://dbjack:Pwd4mydbjack@dbmcloud-93kzh.mongodb.net/dbBack?retryWrites=true&w=majority'
    })

})));


ioServer.on('connection', function(socket){
    connections.push(socket);
   
    console.log('connected: %s sockets connected', connections.length);
    

    //Disconnected
    socket.on('disconnect', function(){
        //if(!socket.username) return;
        users.splice(users.indexOf(socket.username, 1));
        updateUsernames();
        connections.splice(connections.indexOf(socket), 1);

        ioServer.emit('delete', myData);
        delete allFlappys[myData.id];
        console.log('Disconnected: %s sockets connected', connections.length);
    });

/************************Chat Handle************************/   
    //New User
    socket.on('new user', function(data, callback){
        callback(true);
        socket.username = data;
        users.push(socket.username);
        updateUsernames();
    });
    
    //Send Message
    socket.on('send message', function(data){
        console.log(data);
        ioServer.emit('new message', {msg: data, user: socket.username});
    });

    function updateUsernames(){
        ioServer.emit('get users', users);
        console.log("data users",users);
    }


/************************Game Handle************************/        
    let myData = {
        id: 'flappy-' + Math.round(Math.random() * 10000),
        startBtn :{
            x: 120,
            y: 263,
            w: 83,
            h: 29
        },
        bg :{
            sX: 292,
            sY: 0,
            w: 288,
            h: 512,
            x: 0,
            y: 0
        },
        fg :{
            sX: 584,
            sY: 0,
            w: 336,
            h: 113,
            x: 0,
            y: 112,
            dx: 2
        },
        bird: {
            animation: [
                {sX : 276, sY : 112},
                {sX : 276, sY : 139},
                {sX : 276, sY : 164},
                {sX : 276, sY : 139},
            ],
            x : 50,
            y : 150,
            w : 34,
            h : 26,

            radius: 12,
            opacity: '',

            frame: 0,
            gravity: 0.25,
            jump: 3.6,
            speed: 0,
            rotation: 0,

        },
        pipes: {
            top:{
                sX: 553,
                sY: 0
            },
            bottom: {
                sX: 502,
                sY: 0
            },
            w: 53,
            h: 400,
            gap: 105,
            maxYPos: -150,
            dx: 2
        },
        score:{
            best: 0,
            value: 0,
            v1: '#FFF',
            v2: '#000',
            v3: 50,
            v4: 225,
            v5: 186,
            v6: 228
        },
        getReady: {
            sX: 0,
            sY: 228,
            w: 173,
            h: 152,
            x: 173,
            y: 80,
        },
        gameOver: {
            sX: 175,
            sY: 228,
            w: 225,
            h: 202,
            x: 225,
            y: 90,
        }
        
    }
    console.log('myData.id:', myData.id);
    allFlappys[myData.id] = myData;
    
       
    socket.emit('init',myData);
    
    socket.on('birdMove', function(data){
        //console.log('birdMoveooo:',data);
        data.id = myData.id;
        data.animation = myData.bird.animation;
        data.x = myData.bird.x;
        data.w = myData.bird.w;
        data.h = myData.bird.h;
        data.radius = myData.bird.radius;
        //data.opacity = 0.5;
        data.frame = myData.bird.frame;
        data.gravity = myData.bird.gravity;
        data.jump = myData.bird.jump;
        data.speed = myData.bird.speed;
        data.rotation = myData.bird.rotation;
        
        ioServer.emit('update', data);
        
    });
    
    socket.on('disconnect', function(){
        console.log('disconnected !')
        
    });
   
});

