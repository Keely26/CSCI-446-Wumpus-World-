// entry point to script
function run() {
    canvas = document.getElementById('canvas'); // the html5 canvas
    ctx = canvas.getContext('2d');              // the rendering context
    lastTime = (new Date()).getTime();          // the last game loop time
    map = null;                 // 2d char array representing game board
    mapSize = 5;                // the number of tiles 
    running = false;            // if the game is running

    pCol = 0;
    pRow = 0;
    pd = 0;
    numArrows = 1;
    hasGold = false;
    pImg = new Image();
    pImg.src = "player.png";

    window.addEventListener('resize', resizeCanvas, false);
    document.onkeydown = handleKey;

    resizeCanvas();
    gameLoop();
}

function createMap(size) {
    mapSize = size;
    map = Array(mapSize);
    for(i = 0; i < mapSize; i++) {
        map[i] = Array(mapSize);
        for(j = 0; j < mapSize; j++) {
            map[i][j] = ' ';
        }
    }
    coords = getRandomEmptyCoords();
    map[coords[0]][coords[1]] = 'g';

    coords = getRandomEmptyCoords();
    map[coords[0]][coords[1]] = 'w';

    for(i = 0; i < mapSize; i++) {
        for(j = 0; j < mapSize; j++) {
            if(Math.random() < 0.2 && isEmpty(i, j)) {
                map[i][j] = 'p';
            }
        }
    }

    pCol = 0;
    pRow = 0;
    pd = 0;
    running = true;
    hasGold = false;
    numArrows = 1;

    resizeCanvas();
    updateInventory();
    checkLocation();
}

function getRandomEmptyCoords() {
    do {
        x = Math.floor(Math.random()*mapSize);
        y = Math.floor(Math.random()*mapSize);
    }
    while(!isEmpty(x, y));
    
    return [x, y];
}

function isEmpty(x, y) {
    return !(x==0 && y==0) && map[x][y] == ' ';
}

function isValid(x, y) {
    return x >= 0 && x < mapSize && y >= 0 && y < mapSize;
}

function handleKey(e) {
    if(e.keyCode == '38') {
        move(0);
    }
    else if(e.keyCode == '37') {
        move(1);
    }
    else if(e.keyCode == '39') {
        move(2);
    }
    else if(e.keyCode == '40') {
        move(3);
    }
    else if(e.keyCode == '16') {
        move(4);
    }
}

function move(num) {
    // only allow move if the game is running
    if(!running) {
        return;
    }

    // move forward
    if(num == 0) {
        moved = false;
        // move according to the player direction
        if(pd == 0 && pCol < mapSize-1) {
            pCol += 1;
            moved = true;
        }
        else if(pd == 1 && pRow < mapSize-1) {
            pRow += 1;
            moved = true;
        }
        else if(pd == 2 && pCol > 0) {
            pCol -= 1;
            moved = true;
        }
        else if(pd == 3 && pRow > 0) {
            pRow -= 1;
            moved = true;
        }
    }
    // turn left
    else if(num == 1) {
        pd -= 1;
        if(pd < 0) {
            pd = 3
        }
    }
    // turn right
    else if(num == 2) {
        pd += 1;
        if(pd > 3) {
            pd = 0;

        }
    }
    // pick up
    else if(num == 3) {
        if(map[pRow][pCol] == 'g') {
            map[pRow][pCol] = ' ';
            hasGold = true;
        }
    }
    // shoot
    else if(num == 4) {
        shoot();
    }

    checkLocation();
    updateInventory();
}

function shoot() {
    // check if there is an arrow to shoot
    if(numArrows <= 0) {
        return;
    }
    // shoot right
    if(pd == 0) {
        for(i = pCol; i < mapSize; i++) {
            if(map[pRow][i] == "w") {
                map[pRow][i] = " ";
                console.log("You killed the Wumpus!");
            }
        }
    }
    // shoot down
    else if(pd == 1) {
        for(i = pRow; i < mapSize; i++) {
            if(map[i][pCol] == "w") {
                map[i][pCol] = " ";
                console.log("You killed the Wumpus!");
            }
        }
    }
    // shoot left
    else if(pd == 2) {
        for(i = pCol; i >= 0; i--) {
            if(map[pRow][i] == "w") {
                map[pRow][i] = " ";
                console.log("You killed the Wumpus!");
            }
        }
    }
    // shoot up
    else {
        for(i = pRow; i >= 0; i--) {
            if(map[i][pCol] == "w") {
                map[i][pCol] = " ";
                console.log("You killed the Wumpus!");
            }
        }
    }
    // decrement number of arrows
    numArrows -= 1;
}

// update the arrows and gold in inventory
function updateInventory() {
    var node = document.getElementById("items");
    // set number of arrows
    node.innerText = "Arrows x";
    node.innerText += numArrows;
    // set if player is holding gold
    if(hasGold) {
        node.innerText += ",    Gold";
    }
}

// notify player about what is nearby
function checkLocation() {
    list = document.getElementById("infoList");
    list.innerHTML = '';

    // check if player is on wumpus
    if(map[pRow][pCol] == 'w') {
        entry = document.createElement("li");
        entry.appendChild(document.createTextNode("You were eaten by the Wumpus!"));
        list.appendChild(entry);
        running = false;
    }
    // check if player is on pit
    if(map[pRow][pCol] == 'p') {
        entry = document.createElement("li");
        entry.appendChild(document.createTextNode("You fell into a pit!"));
        list.appendChild(entry);
        running = false;
    }
    // check if the player died from wumpus or pit
    if(!running) {
        entry = document.createElement("li");
        entry.appendChild(document.createTextNode("You lose!"));
        list.appendChild(entry);
        return;
    }

    // set current tile to visited
    if(map[pRow][pCol] == " ") {
        map[pRow][pCol] = "v";
    }

    // the player wins if they have gold and
    // are on the top left square
    if(pRow == 0 && pCol == 0 && hasGold) {
        entry = document.createElement("li");
        entry.appendChild(document.createTextNode("You win!"));
        list.appendChild(entry);
        running = false;
        return;
    }

    // notify if wumpus is in 4 surrounding squares
    if(nearWumpus()) {
        entry = document.createElement("li");
        entry.appendChild(document.createTextNode("You smell a stench."));
        list.appendChild(entry);
    }
    // notify if pit is in 4 surrounding squares
    if(nearPit()) {
        entry = document.createElement("li");
        entry.appendChild(document.createTextNode("You feel a breeze."));
        list.appendChild(entry);
    }
    // notify if gold is in current square
    if(nearGold()) {
        entry = document.createElement("li");
        entry.appendChild(document.createTextNode("You see a glitter."));
        list.appendChild(entry);
    }
}

// get the char values of the 4 adjacent squares
function getNeighborValues(row, col) {
    neighborValues = [];
    neighbors = [[row-1, col], [row+1, col],
                 [row, col-1], [row, col+1]];
    for(i = 0; i < neighbors.length; i++) {
        n = neighbors[i];
        if(isValid(n[0], n[1])) {
            neighborValues.push(map[n[0]][n[1]]);
        }
    }
    return neighborValues;
}

// check if the player is near the wumpus
function nearWumpus() {
    return getNeighborValues(pRow, pCol).includes("w");
}

// check if the player is near a pit
function nearPit() {
    return getNeighborValues(pRow, pCol).includes("p");
}

// check if the player is on the gold square
function nearGold() {
    return map[pRow][pCol] == "g";
}

// animate -- this isn't necessary
function gameLoop() {
    window.requestAnimationFrame(gameLoop);

    currentTime = (new Date()).getTime();
    delta = (currentTime-lastTime)/1000;

    draw();

    lastTime = currentTime;
}

// draw game board on canvas
function draw() {
    // clear canvas
    ctx.clearRect(0, 0, canvasSize,canvasSize);

    // draw map if created
    if(map) {
        for(row = 0; row < mapSize; row++) {
            for(col = 0; col < mapSize; col++) {
                char = map[row][col];
                // if the game is running only draw
                // whether a square is or isn't visited
                // don't draw pits, wumpus, or gold
                if(char == " " || char == "v" || running) {
                    // draw visited squares
                    if(char == "v" && running) {
                        ctx.fillStyle = "#ADD8E6";
                    }
                    // draw unvisited squares
                    else {
                        ctx.fillStyle = "gray";
                    }
                }
                // draw wumpus
                else if(char == "w") {
                    ctx.fillStyle = "red";
                }
                // draw gold
                else if(char == "g") {
                    ctx.fillStyle = "yellow";
                }
                // draw pit
                else if(char == "p") {
                    ctx.fillStyle = "black";
                }
                // draw rectangle with specific color
                ctx.fillRect(col*tileSize, row*tileSize, tileSize, tileSize);
            
                // draw square border
                ctx.strokeStyle = 'black';
                ctx.strokeRect(col*tileSize, row*tileSize, tileSize, tileSize);
            }
        }
        // draw player image with correct rotation
        ctx.translate(pCol*tileSize + tileSize/2, pRow*tileSize + tileSize/2);
        ctx.rotate(pd/2 * Math.PI);
        ctx.drawImage(pImg, -tileSize/2 * 0.9, -tileSize/2 * 0.9, tileSize * 0.9, tileSize * 0.9);
        ctx.rotate(-pd/2 * Math.PI);
        ctx.translate(-(pCol*tileSize + tileSize/2), -(pRow*tileSize + tileSize/2));
    }
    // otherwise draw prompt to create a map
    else {
        ctx.font="20px Arial";
        ctx.textAlign="center";
        ctx.fillText("Press a Button to Create a Map!", canvasSize/2, canvasSize/2);
    }
}

// resize canvas and update tileSize when window size changes
function resizeCanvas(){
    canvasSize = Math.min(wrapper.offsetWidth - 20, wrapper.offsetHeight - 300);
    tileSize = canvasSize / mapSize;
    canvas.width = canvasSize;
    canvas.height = canvasSize;
    draw();
}