// entry point to script
function run() {
    canvas = document.getElementById('canvas'); // the html5 canvas
    ctx = canvas.getContext('2d');              // the rendering context
    lastTime = (new Date()).getTime();          // the last game loop time
    map = null;                 // 2d char array representing game board
    mapSize = 5;                // the number of tiles 
    running = false;            // if the game is running
    dead = false;               // if the player is dead

    pCol = 0;                   // the col the player is in
    pRow = 0;                   // the row the player is in
    pd = 0;                     // the direction the player is facing 0:right,1:down,2:left,3:top
    numArrows = 1;              // number of arrows in inventory
    hasGold = false;            // if the player is holding gold
    pImg = new Image();         // image for the player
    pImg.src = "player.png";

    window.addEventListener('resize', resizeCanvas, false);
    document.onkeydown = handleKey; //call key handler function when key pressed

    resizeCanvas();
    gameLoop();
}

// randomly populate a map with given size
// one wumpus
// one gold
// pits placed with 20% probability
function createMap(size) {
    // initialize map and player's visited map as empty squares
    mapSize = size;
    map = Array(mapSize);
    tileKnowledge = Array(mapSize)
    for (i = 0; i < mapSize; i++) {
        map[i] = Array(mapSize);
        tileKnowledge[i] = Array(mapSize)
        for (j = 0; j < mapSize; j++) {
            map[i][j] = ' ';
            tileKnowledge[i][j] = new PerceptNode()
        }
    }
    // place gold
    coords = getRandomEmptyCoords();
    map[coords[0]][coords[1]] = 'g';

    // place wumpus
    coords = getRandomEmptyCoords();
    map[coords[0]][coords[1]] = 'w';

    // place pits
    for (i = 0; i < mapSize; i++) {
        for (j = 0; j < mapSize; j++) {
            if (Math.random() < 0.2 && isEmpty(i, j)) {
                map[i][j] = 'p';
            }
        }
    }

    // reset variables for new game
    pCol = 0;
    pRow = 0;
    pd = 0;
    running = true;
    dead = false;
    hasGold = false;
    numArrows = 1;

    // reset inventory and location information
    resizeCanvas();
    updateInventory();
    checkLocation();
}

function haltAI() {
    console.log("Terminating AI")
    running = false
}

async function runAI() {
    console.log("starting AI!")

    while (running) {
        console.log("~~~ START TICK ~~~")
        turnComplete = false;

        // Store some of the percept for this tile. 
        ourPercept = tileKnowledge[pRow][pCol]
        ourPercept.nearWumpus = nearWumpus()
        ourPercept.nearPit = nearPit()
        ourPercept.visited = true
        tileKnowledge[pRow][pCol] = ourPercept

        // Run a pass over the percepts to (hopefully) do some learning
        calculatePercepts()

        // Turn until we aren't facing a wall
        while (isFacingWall()) {
            // TODO: This shouldn't be random
            if (Math.random() <= .5) {
                move(1)
            } else {
                move(2)
            }
        }

        // If we have gold, return home
        if (hasGold && !turnComplete) {
            await returnHome()
            turnComplete = true
        }

        // If we are standing on gold, pick it up
        if (nearGold() && !turnComplete) {
            move(3)
            turnComplete = true
        }

        if (!turnComplete) {
            console.log("I'm doing the weird stuff! :D")
            tileChoice = Array(4)

            if (isValid(pRow, pCol + 1)) {
                tileChoice[0] = await guessTile(pRow, pCol + 1)
            }
            if (isValid(pRow + 1, pCol)) {
                tileChoice[1] = await guessTile(pRow + 1, pCol)
            }
            if (isValid(pRow, pCol - 1)) {
                tileChoice[2] = await guessTile(pRow, pCol - 1)
            }
            if (isValid(pRow - 1, pCol)) {
                tileChoice[3] = await guessTile(pRow - 1, pCol)
            }

            visitedTile = -1
            bestDirection = -1
            lowestDangerScore = 9999
            for (i = 0; i < 4; i++) {
                if (tileChoice[i] == null) {
                    console.info("Tile in pos " + i + "Will not be considered")
                    continue
                }

                dangerScore = (tileChoice[i][0] + tileChoice[i][1])

                // Visited Tile, only use if we have to
                if (dangerScore < 0) {
                    visitedTile = i
                    continue
                }

                console.log("For tile pos " + i + " " + tileChoice[i][0] + " " + tileChoice[i][1])
                console.log("danger Score" + dangerScore)

                if (dangerScore < lowestDangerScore) {
                    lowestDangerScore = dangerScore
                    bestDirection = i
                } else if (dangerScore == lowestDangerScore) {
                    rand = Math.random()
                    if (rand <= 0.5 || lowestDangerScore == 9999) {
                        lowestDangerScore = dangerScore
                        bestDirection = i
                    }
                }

            }

            console.log("Turning to face %d", bestDirection)
            while (pd != bestDirection && bestDirection != -1) {
                move(1)
            }
            lastRow = pRow
            lastCol = pCol
            move(0)

            turnComplete = true
        }

        if (!turnComplete) {
            console.error("Empty Turn! No move was made")
        }
        gameLoop()
        console.log("~~~ END TICK ~~~\n\n\n")

        // Sleep for 400ms for rendering purposes
        await new Promise(resolve => setTimeout(resolve, 400));

    }
}

async function returnHome() {

    // TODO: BFS
    // Keep trying to get home as long as we aren't there
    while (pCol != 0 || pRow != 0) {
        moveComplete = false

        if (isValid(pRow - 1, pCol) && !moveComplete) {
            if (map[pRow - 1][pCol] == 'v') {
                while (pd != 3) {
                    move(1)
                }
                move(0)

                moveComplete = true
            } else if (!nearPit || !nearWumpus) {
                move(0)
                moveComplete = true
            }
        }

        if (isValid(pRow, pCol - 1) && !moveComplete) {
            if (map[pRow][pCol - 1] == 'v') {
                while (pd != 2) {
                    move(1)
                }
                move(0)
                moveComplete = true
            }
        } else if (!nearPit || !nearWumpus) {
            move(0)
            moveComplete = true

        }

        if (isValid(pRow + 1, pCol) && !moveComplete) {
            if (map[pRow + 1][pCol] == 'v') {
                while (pd != 1) {
                    move(1)
                }
                move(0)
                moveComplete = true
            }
        }

        if (isValid(pRow, pCol + 1) && !moveComplete) {
            if (map[pRow][pCol + 1] == 'v') {
                while (pd != 0) {
                    move(1)
                }
                move(0)
                moveComplete = true
            }
        }
        await new Promise(resolve => setTimeout(resolve, 400));
        gameLoop()
    }
}

// return coordinates of an empty square
function getRandomEmptyCoords() {
    do {
        row = Math.floor(Math.random() * mapSize);
        col = Math.floor(Math.random() * mapSize);
    }
    while (!isEmpty(row, col));

    return [row, col];
}


function calculatePercepts() {
    for (i = 0; i < mapSize; i++) {
        for (j = 0; j < mapSize; j++) {

        }
    }



}

function guessTile(row, col) {

    // Get our current tile's info
    thisPercept = tileKnowledge[row][col]

    percent = new Array(2)

    // If we've visited this tile, all is well, and it has a 0% chance of being a bad tile
    if (map[row][col] == 'v') {
        thisPercept.probabilityPit = 0
        thisPercept.probabilityWumpus = 0
        return thisPercept
    }

    console.log("Started guessing a tile: R=" + row + " C=" + col)


    pIsPit = 0
    pIsWumpus = 0
    visitedTiles = 0
    percepts = Array(4)

    if (isValid(row + 1, col)) {
        percepts[1] = tileKnowledge[row + 1][col]
        console.log("down is a valid location. Percept: " + percepts[0])
    }
    if (isValid(row - 1, col)) {
        percepts[3] = tileKnowledge[row - 1][col]
        console.log("up is a valid location. Percept: " + percepts[1])
    }
    if (isValid(row, col - 1)) {
        percepts[2] = tileKnowledge[row][col - 1]
        console.log("left is a valid location. Percept: " + percepts[2])
    }
    if (isValid(row, col + 1)) {
        percepts[0] = tileKnowledge[row][col + 1]
        console.log("right is a valid location. Percept: " + percepts[3])

    }

    percepts.forEach(function (percept, i) {
        if (percept.visited == false) {
            console.log(i + " was not visited percept " + percept)
            pIsPit += .15
            pIsWumpus += .15
            return
        } else {
            console.log(i + " was percept " + percept)
            visitedTiles++
        }

        if (percept.nearPit == true) {
            console.log(i + " is near a pit " + percept)
            pIsPit += .30
        }
        if (percept.nearWumpus == true) {
            console.log(i + " is near a wumpus " + percept)
            pIsWumpus += .30
        }
    })

}

// handle keyboard input
function handleKey(e) {
    // i don't remember which numbers corespond to which key
    if (e.keyCode == '38') {
        move(0);
    }
    else if (e.keyCode == '37') {
        move(1);
    }
    else if (e.keyCode == '39') {
        move(2);
    }
    else if (e.keyCode == '40') {
        move(3);
    }
    else if (e.keyCode == '16') {
        move(4);
    }
}


function move(num) {
    // only allow move if the game is running
    if (!running) {
        return;
    }

    // move forward
    if (num == 0) {
        moved = false;
        // move according to the player direction
        if (pd == 0 && pCol < mapSize - 1) {
            pCol += 1;
            moved = true;
        }
        else if (pd == 1 && pRow < mapSize - 1) {
            pRow += 1;
            moved = true;
        }
        else if (pd == 2 && pCol > 0) {
            pCol -= 1;
            moved = true;
        }
        else if (pd == 3 && pRow > 0) {
            pRow -= 1;
            moved = true;
        }
    }
    // turn left
    else if (num == 1) {
        pd -= 1;
        if (pd < 0) {
            pd = 3
        }
    }
    // turn right
    else if (num == 2) {
        pd += 1;
        if (pd > 3) {
            pd = 0;

        }
    }
    // pick up
    else if (num == 3) {
        if (map[pRow][pCol] == 'g') {
            map[pRow][pCol] = ' ';
            hasGold = true;
        }
    }
    // shoot
    else if (num == 4) {
        shoot();
    }

    checkLocation();
    updateInventory();
}

function shoot() {
    // check if there is an arrow to shoot
    if (numArrows <= 0) {
        return;
    }
    // shoot right
    if (pd == 0) {
        for (i = pCol; i < mapSize; i++) {
            if (map[pRow][i] == "w") {
                map[pRow][i] = " ";
                console.log("You killed the Wumpus!");
            }
        }
    }
    // shoot down
    else if (pd == 1) {
        for (i = pRow; i < mapSize; i++) {
            if (map[i][pCol] == "w") {
                map[i][pCol] = " ";
                console.log("You killed the Wumpus!");
            }
        }
    }
    // shoot left
    else if (pd == 2) {
        for (i = pCol; i >= 0; i--) {
            if (map[pRow][i] == "w") {
                map[pRow][i] = " ";
                console.log("You killed the Wumpus!");
            }
        }
    }
    // shoot up
    else {
        for (i = pRow; i >= 0; i--) {
            if (map[i][pCol] == "w") {
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
    if (hasGold) {
        node.innerText += ",    Gold";
    }
}

// notify player about what is nearby, and update the map
function checkLocation() {
    list = document.getElementById("infoList");
    list.innerHTML = '';

    // check if player is on wumpus
    if (map[pRow][pCol] == 'w') {
        entry = document.createElement("li");
        entry.appendChild(document.createTextNode("You were eaten by the Wumpus!"));
        list.appendChild(entry);

        running = false;
    }
    // check if player is on pit
    if (map[pRow][pCol] == 'p') {
        entry = document.createElement("li");
        entry.appendChild(document.createTextNode("You fell into a pit!"));
        list.appendChild(entry);
        running = false;
    }
    // check if the player died from wumpus or pit
    if (!running) {
        entry = document.createElement("li");
        entry.appendChild(document.createTextNode("You lose!"));
        list.appendChild(entry);
        died = true;
        gameLoop()
        return;
    }

    // set current tile to visited
    if (map[pRow][pCol] == " " || map[pRow][pCol] == "h") {
        map[pRow][pCol] = "v";
    }


    // Update horizon squares
    if (isValid(pRow + 1, pCol)) {
        if (map[pRow + 1][pCol] == " ") {
            map[pRow + 1][pCol] = 'h'
        }
    }
    if (isValid(pRow - 1, pCol)) {
        if (map[pRow - 1][pCol] == " ") {
            map[pRow - 1][pCol] = 'h'
        }
    }
    if (isValid(pRow, pCol + 1)) {
        if (map[pRow][pCol + 1] == " ") {
            map[pRow][pCol + 1] = 'h'
        }
    }
    if (isValid(pRow, pCol - 1)) {
        if (map[pRow][pCol - 1] == " ") {
            map[pRow][pCol - 1] = 'h'
        }
    }

    // the player wins if they have gold and
    // are on the top left square
    if (pRow == 0 && pCol == 0 && hasGold) {
        entry = document.createElement("li");
        entry.appendChild(document.createTextNode("You win!"));
        list.appendChild(entry);
        running = false;
        return;
    }

    // notify if wumpus is in 4 surrounding squares
    if (nearWumpus()) {
        entry = document.createElement("li");
        entry.appendChild(document.createTextNode("You smell a stench."));
        list.appendChild(entry);
    }
    // notify if pit is in 4 surrounding squares
    if (nearPit()) {
        entry = document.createElement("li");
        entry.appendChild(document.createTextNode("You feel a breeze."));
        list.appendChild(entry);
    }
    // notify if gold is in current square
    if (nearGold()) {
        entry = document.createElement("li");
        entry.appendChild(document.createTextNode("You see a glitter."));
        list.appendChild(entry);
    }
}

// get the char values of the 4 adjacent squares
function getNeighborValues(row, col) {
    neighborValues = [];
    neighbors = [[row - 1, col], [row + 1, col],
    [row, col - 1], [row, col + 1]];
    for (i = 0; i < neighbors.length; i++) {
        n = neighbors[i];
        if (isValid(n[0], n[1])) {
            neighborValues.push(map[n[0]][n[1]]);
        }
    }
    return neighborValues;
}

///////////////////////////
// Player Helper Functions
///////////////////////////
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

// checxk if the player is surrounded by visited tiles
function surroundedByVisited() {
    return getNeighborValues(pRow, pCol).every(v => v == "v");
}

function isFacingCoords(row, col) {
    if (pd == 0 && (pCol + 1) == col) {
        return true;
    }
    // Facing down
    else if (pd == 1 && (pRow + 1) == row) {
        return true;
    }
    // Facing left
    else if (pd == 2 && (pCol - 1) == col) {
        return true;
    }
    // Facing up
    else if (pd == 3 && (pRow - 1) == row) {
        return true;
    }
    return false
}

function isFacingWall() {
    // Facing right
    if (pd == 0 && pCol < mapSize - 1) {
        return false;
    }
    // Facing left
    else if (pd == 1 && pRow < mapSize - 1) {
        return false;
    }
    // Facing down
    else if (pd == 2 && pCol > 0) {
        return false;
    }
    // Facing up
    else if (pd == 3 && pRow > 0) {
        return false;

    }
    return true;
}

function isFacingVisitedSquare() {
    // Facing right
    if (pd == 0 && (pCol + 1) < mapSize) {
        if (map[pRow][pCol + 1] == 'v') {
            return true;
        }
    }
    // Facing down
    else if (pd == 1 && (pRow + 1) < mapSize) {
        if (map[pRow + 1][pCol] == 'v') {
            return true;
        }
    }
    // Facing left
    else if (pd == 2 && (pCol - 1) > -1) {
        if (map[pRow][pCol - 1] == 'v') {
            return true;
        }
    }
    // Facing up
    else if (pd == 3 && (pRow - 1) > -1) {
        if (map[pRow - 1][pCol] == 'v') {
            return true;
        }
    }
    return false;
}

// if a square is empty
function isEmpty(row, col) {
    return !(row == 0 && col == 0) && map[row][col] == ' ';
}

// if a square is in the map
function isValid(row, col) {
    return row >= 0 && row < mapSize && col >= 0 && col < mapSize;
}


//////////////
// Rendering Logic
//////////////

// animate
function gameLoop() {

    currentTime = (new Date()).getTime();
    delta = (currentTime - lastTime);
    // console.log(delta)

    if (delta > 70 || !running) {
        draw();
        window.requestAnimationFrame(gameLoop);
        lastTime = currentTime;

    }



}

// draw game board on canvas
function draw() {
    // clear canvas
    ctx.clearRect(0, 0, canvasSize, canvasSize);

    // draw map if created
    if (map) {
        for (row = 0; row < mapSize; row++) {
            for (col = 0; col < mapSize; col++) {
                char = map[row][col];
                // if the game is running only draw
                // whether a square is or isn't visited
                // don't draw pits, wumpus, or gold
                if (char == " " || char == "v" || char == "h" || !running) {
                    // draw visited squares
                    if (char == "v" && running) {
                        ctx.fillStyle = "#ADD8E6";
                    }
                    else if (char == "h" && running) {
                        ctx.fillStyle = "pink"
                    }
                    //draw unvisited squares
                    else {
                        ctx.fillStyle = "gray";
                    }
                }
                // draw wumpus
                else if (char == "w") {
                    ctx.fillStyle = "red";
                }
                // draw gold
                else if (char == "g") {
                    ctx.fillStyle = "yellow";
                }
                // draw pit
                else if (char == "p") {
                    ctx.fillStyle = "black";
                }
                // draw rectangle with specific color
                ctx.fillRect(col * tileSize, row * tileSize, tileSize, tileSize);

                // draw square border
                ctx.strokeStyle = 'black';
                ctx.strokeRect(col * tileSize, row * tileSize, tileSize, tileSize);

                // Draw Percept overlay
                percept = tileKnowledge[row][col]

                ctx.font = tileSize / 4 + "px Arial";
                if (percept.nearWumpus) {
                    ctx.fillStyle = 'orange';
                    ctx.fillText("NW", col * tileSize, row * tileSize + tileSize - (tileSize / 4.5));
                }
                if (percept.nearPit) {
                    ctx.fillStyle = 'black';
                    ctx.fillText("NP", col * tileSize, row * tileSize + tileSize);

                }
                if (percept.knownPit) {
                    ctx.font = tileSize / 3 + "px Arial";
                    ctx.fillStyle = 'white';
                    ctx.fillText("PIT?", col * tileSize, row * tileSize + tileSize - (tileSize / 2));
                }


            }
        }
        // draw player image with correct rotation
        ctx.translate(pCol * tileSize + tileSize / 2, pRow * tileSize + tileSize / 2);
        ctx.rotate(pd / 2 * Math.PI);
        ctx.drawImage(pImg, -tileSize / 2 * 0.9, -tileSize / 2 * 0.9, tileSize * 0.9, tileSize * 0.9);
        ctx.rotate(-pd / 2 * Math.PI);
        ctx.translate(-(pCol * tileSize + tileSize / 2), -(pRow * tileSize + tileSize / 2));
    }
    // otherwise draw prompt to create a map
    else {
        ctx.font = "20px Arial";
        ctx.textAlign = "center";
        ctx.fillText("Press a Button to Create a Map!", canvasSize / 2, canvasSize / 2);
    }
}

// resize canvas and update tileSize when window size changes
function resizeCanvas() {
    canvasSize = Math.min(wrapper.offsetWidth - 20, wrapper.offsetHeight - 300);
    tileSize = canvasSize / mapSize;
    canvas.width = canvasSize;
    canvas.height = canvasSize;
    draw();
}



class PCoord {
    constructor(row, col) {
        this.row = row;
        this.col = col;
    }
}

class PerceptNode {
    probabilityPit = 0;
    probabilityWumpus = 0;

    nearPit;
    nearWumpus;
    visited;
}