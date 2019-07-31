$(function(){

    /************************Chat Handle************************/
    var socket = io.connect();
    var $messageForm = $('#messageForm');
    var $message = $('#message');
    var $chat = $('#chat');
    var $messageArea = $('#messageArea');
    var $users = $('#users');
    /*
    var $userFormArea = $('#userFormArea');
    var $userForm = $('#userForm');
    
    var $username = $('#username');
    */

    $messageForm.submit(function(e){
        e.preventDefault();
        socket.emit('send message', $message.val());
        $message.val('');
    });

    socket.on('new message', function(data){
        $chat.append('<div class="card card-body bg-light"><strong>'+data.user+'</strong>:'+ data.msg+'</div>');
    });

    
    socket.on('get users', function(data){
        var html = '';
        console.log('users:', data);
        for(let i = 0; i< data.length; i++){
            html += '<li class="list-group-item">'+data[i]+'</li> ';
        }
        $users.html(html);
    });

    /****************************Game Handle****************************/
    var cvs = document.getElementById('canvas');
    var ctx = cvs.getContext("2d");

    //load sprite

    const sprite = new Image();
    sprite.src = "./src/images/flappysprite.png"
    const birdSprite = new Image();
    birdSprite.src = "./src/images/sprite.png"

    //load Sounds

    const SCORE_S = new Audio();
    SCORE_S.src = "./src/audio/sfx_point.wav";

    const FLAP = new Audio();
    FLAP.src = "./src/audio/sfx_flap.wav";

    const HIT = new Audio();
    HIT.src = "./src/audio/sfx_hit.wav";

    const SWOOSHING = new Audio();
    SWOOSHING.src = "./src/audio/sfx_swooshing.wav";

    const DIE = new Audio();
    DIE.src = "src/audio/sfx_die.wav";


    //GAME STATE
    const state = {
        current: 0,
        getReady: 0,
        game: 1,
        over: 2

    }

    // Variables
    let frames = 0;
    const DEGREE = Math.PI/180;

    var bg = (function(){
        class Bg {
            constructor(data){
                this.sX= data.sX;
                this.sY= data.sY;
                this.w= data.w;
                this.h= data.h;
                this.x= data.x;
                this.y= data.y;
            }
            draw(){
                ctx.drawImage(sprite, this.sX, this.sY, this.w, this.h, this.x, this.y, this.w, this.h);
                ctx.drawImage(sprite, this.sX, this.sY, this.w, this.h, this.x + this.w, this.y, this.w, this.h);
            } 
        }
        return function(data){
            return new Bg(data);
        }
    }());
    
    var fg = (function(){
        class Fg {
            constructor(data){
                this.sX= data.sX;
                this.sY= data.sY;
                this.w= data.w;
                this.h= data.h;
                this.x= data.x;
                this.y= cvs.height - data.y;
                this.dx= data.dx;
            }
        
            draw(){
                ctx.drawImage(sprite, this.sX, this.sY, this.w, this.h, this.x, this.y, this.w, this.h);
    
                ctx.drawImage(sprite, this.sX, this.sY, this.w, this.h, this.x+this.w, this.y, this.w, this.h);
            }
    
            update(){
                //console.log('dans update current',state.current );
                //console.log('dans update game',state.game );
                if(state.current == state.game){
                    return this.x = (this.x - this.dx)%(this.w/2);
                }
                //console.log('pas dans update',state.game);
            }
        }
        return function(data){
            return new Fg(data);
        }
    })();

    var bird = (function(){
        class Bird {
            constructor(data){
                this.animation= [
                    {sX : data.animation[0].sX, sY : data.animation[0].sY},
                    {sX : data.animation[1].sX, sY : data.animation[1].sY},
                    {sX : data.animation[2].sX, sY : data.animation[2].sY},
                    {sX : data.animation[3].sX, sY : data.animation[3].sY},
                ];
                this.x = data.x;
                this.y = data.y;
                this.w = data.w;
                this.h = data.h;
    
                this.radius= data.radius;
                this.opacity= data.opacity || 1
    
                this.frame= data.frame;
                this.gravity= data.gravity;
                this.jump= data.jump;
                this.speed= data.speed;
                this.rotation= data.rotation;
            }
            draw(){
                let bird = this.animation[this.frame];
                //console.log('bird ds draw',bird)
                ctx.save();
                ctx.translate(this.x, this.y);
                ctx.rotate(this.rotation);
                //ctx.globalAlpha = this.opacity || 1;
                ctx.drawImage(birdSprite, bird.sX, bird.sY, this.w, this.h,  - this.w/2,  - this.h/2, this.w, this.h);

                ctx.restore();
            }
            drawAutres(){
                let bird = this.animation[this.frame];
                //console.log('bird ds draw',bird)
                ctx.save();
                ctx.translate(this.x, this.y);
                ctx.rotate(this.rotation);
                ctx.globalAlpha = 0.5;
                ctx.drawImage(birdSprite, bird.sX, bird.sY, this.w, this.h,  - this.w/2,  - this.h/2, this.w, this.h);

                ctx.restore();
            }
           
            flap(){
                this.speed = -this.jump;
                return this.speed;
            }
            
            update(data){
                //console.log('bird update');
                //If the game state is getReady, the bird must flap slowly
            
                this.period = state.current == state.getReady ? 10 : 5;
                //We increment the frame by 1, for each period
                
                this.frame += frames%this.period == 0 ? 1 : 0;
                // frame goes from 0 to 4, then again to 0
                this.frame = this.frame%this.animation.length;

                if(state.current == state.getReady){
                    this.y = 150; //reset position of the bird after game Over
                    this.rotation = 0 * DEGREE; 
                }else{
                    this.speed += this.gravity;
                    this.y += this.speed;
                    //socket.emit('birdY', this.y);

                    if(this.y + this.h/2 >= cvs.height - data.h){
                        this.y = cvs.height - data.h - this.h/2;
                        if(state.current == state.game){
                            state.current = state.over;
                            DIE.play();                    
                        }
                    }
                    // if the speed is greater than jump means the bird is falling down
                    if(this.speed >= this.jump){
                        this.rotation = 90 * DEGREE;
                        this.frame = 1;
                    }else{
                        this.rotation = -25 * DEGREE;
                    }
                }
            }
            speedReset(){
                this.speed = 0;
            }
           

        }
        return function(data){
            return new Bird(data);
        }
    })();
    
    var pipes = (function(){
        class Pipes {
            constructor(data){
                this.position = [];

                this.top={
                    sX: data.top.sX,
                    sY: data.top.sY
                };
                this.bottom= {
                    sX: data.bottom.sX,
                    sY: data.bottom.sY
                };
                this.w= data.w;
                this.h= data.h;
                this.gap= data.gap;
                this.maxYPos= data.maxYPos;
                this.dx= data.dx;
            }
            draw(){
                for(let i = 0; i < this.position.length; i++){
                    let p = this.position[i];

                    let topYPos = p.y;
                    let bottomYPos = p.y + this.h + this.gap;

                    //top pipe
                    ctx.drawImage(birdSprite, this.top.sX, this.top.sY, this.w, this.h, p.x, topYPos, this.w, this.h);
                   
                    //bottom pipe
                    ctx.drawImage(birdSprite, this.bottom.sX, this.bottom.sY, this.w, this.h, p.x, bottomYPos, this.w, this.h);
                    
                }
            }
            update(data, data2){
                
                if(state.current !== state.game){return};

                if(frames%100 == 0){
                    this.position.push({
                        x: cvs.width,
                        y: this.maxYPos * (Math.random() + 1)
                    });
                }
                
                for(let i = 0; i < this.position.length; i++){
                    let p = this.position[i];
                    let bottomPipeYPos = p.y + this.h + this.gap;
                   
                    // Collision detection
                    // top pipe
                    if(data.x + data.radius > p.x && data.x - data.radius < p.x + this.w && data.y + data.radius > p.y && data.y - data.radius < p.y + this.h){
                        state.current = state.over;
                        HIT.play();
                    }
                    // bottom pipe
                    if(data.x + data.radius > p.x && data.x - data.radius < p.x + this.w && data.y + data.radius > bottomPipeYPos && data.y - data.radius < bottomPipeYPos + this.h){
                        state.current = state.over;
                        HIT.play();
                        
                    }

                    //if the pipe go beyond canvas, we delete them from the array
                    if(p.x + this.w <= 0){
                        this.position.shift();
                        data2.value += 1 ;
                        SCORE_S.play();

                        data2.best = Math.max(data2.value, data2.best);
                        localStorage.setItem("best", data2.best);
                        
                    } 
                    
                    // pipe move to the left side
                    p.x -= this.dx;
                }
               
            }
            reset (){
                this.position = [];
            }
        }

        return function(data){
            return new Pipes(data);
        }
    })();
    
    
    class Score {
        constructor(data){
            this.best= parseInt(localStorage.getItem('best')) || data.best;
            this.value= data.value;
            this.v1= data.v1;
            this.v2= data.v2;
            this.v3= data.v3;
            this.v4= data.v4;
            this.v5= data.v5;
            this.v6= data.v6;
        }
        draw(){
            ctx.fillStyle = this.v1;
            ctx.strokeStyle = this.v2;

            if(state.current == state.game){
                ctx.lineWidth = 2;
                ctx.font = "35px Teko";
                ctx.fillText(this.value, cvs.width/2, this.v3);
                ctx.strokeText(this.value, cvs.width/2, this.v3);
            }else if(state.current == state.over){
                // score value
                ctx.font = "25px Teko";
                ctx.fillText(this.value, this.v4, this.v5);
                ctx.strokeText(this.value, this.v4, this.v5);
                // best score
                ctx.fillText(this.best, this.v4, this.v6);
                ctx.strokeText(this.best, this.v4, this.v6); 
            }


        }
        reset(){
            this.value = 0;
        }

    }
   
   
    class GetReady {
        constructor(data){
            this.sX= data.sX;
            this.sY= data.sY;
            this.w= data.w;
            this.h= data.h;
            this.x= cvs.width/2 - data.x/2;
            this.y= data.y;                    
        }
        draw() {
            if(state.current == state.getReady){
                ctx.drawImage(birdSprite, this.sX, this.sY, this.w, this.h, this.x, this.y, this.w, this.h);
            }
        
        }
    }
     
    class GameOver{
        constructor(data){
            this.sX= data.sX;
            this.sY= data.sY;
            this.w= data.w;
            this.h= data.h;
            this.x= cvs.width/2 - data.x/2;
            this.y= data.y;
        }
        draw(){
            if(state.current==state.over){
                ctx.drawImage(birdSprite, this.sX, this.sY, this.w, this.h, this.x, this.y, this.w, this.h);
            };
        
        }
    }
       

    socket.on('init', function(data){
        var bgDrawg = bg(data.bg);
        var fgDraw = fg(data.fg);
        var birdDraw = bird(data.bird);
        var pipesDraw = pipes(data.pipes);
        var scoreDraw = new Score(data.score);
        var getReadyDraw = new GetReady(data.getReady);
        var gameOverDraw = new GameOver(data.gameOver);
        //console.log('onInit', birdDraw);
        
        
        //CONTROL THE GAME
        cvs.addEventListener('click', function(evt){
            switch(state.current){
                case state.getReady:
                    state.current = state.game;
                    SWOOSHING.play();
                    break;
                case state.game:
                    birdDraw.flap();
                    FLAP.play();
                    break;
                case state.over:
                    let rect = cvs.getBoundingClientRect();
                    let clickX = evt.clientX - rect.left;
                    let clickY = evt.clientY - rect.top;

                    //check if we click on the start button
                    if(clickX >= data.startBtn.x && clickX <= data.startBtn.x + data.startBtn.w && clickY >= data.startBtn.y && clickY <= data.startBtn.y + data.startBtn.h){
                        pipesDraw.reset();
                        birdDraw.speedReset();
                        scoreDraw.reset();
                        state.current = state.getReady;
                    }
                   
                    break;
            }
        });
        function draw (){
            bgDrawg.draw();
            pipesDraw.draw();
            fgDraw.draw();
            birdDraw.draw();  
            getReadyDraw.draw();
            gameOverDraw.draw();   
            scoreDraw.draw();
            
            socket.emit('birdMove',{
                y: birdDraw.y, 
                x: birdDraw.x 
            });
            
        };
        function update (){
           
            fgDraw.update();
            birdDraw.update(data.fg);
            pipesDraw.update(birdDraw, scoreDraw);
            
        };
        
        // LOOP
        function loop (){
            update();
            draw();
            frames++;

            requestAnimationFrame(loop);
        }
        loop();
    });
    
    socket.on('update', (data)=>{
        var birdDraw1 = bird(data);
        birdDraw1.drawAutres();
        console.log('birdDraw1:',birdDraw1.id)
    });
    
});