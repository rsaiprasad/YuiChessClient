/*
 * @TODO: export of pgn
 * @TODO: display of pgn, with ability to run through with comment display.
 * @TODO: code commenting. 
 * @TODO: backend for playing.
 * @TODO: better function / property names.
 * @TODO: handle three fold repetetion and half moves draws.
 * @TODO: source and destination squares highlight after a move.
 * @TODO: improve ui
 * @TODO: notation generated is not proper.
 * @TODO: during promotion, if flip board is done then the promotion dialogue is displayed upside down.
 */
/*YUI_config = {
    debug: true,
    filter: 'debug',
};*/
YUI().add('chess_board', function (Y) {

    var DEFAULT_BOARD_ID = "cboard",
        isRendered = false,
        isBinded = false,
        drags = {},
        drops = {};

    /* Chess Board Constructor */
    function ChessBoard(config) {
        ChessBoard.superclass.constructor.apply(this, arguments);
    }


    ChessBoard.NAME = "ChessBoard";
    ChessBoard.ATTRS = {
        position: {
            value: new Y.ChessPosition()
        }
    };

    /* class functions */
   
    /* get Dialog is closure conditional which creates and returns a dialog only if not created earlier */
    ChessBoard.getDialog = (function () {
        var dialog;
        return function () {
            if (!dialog) {
                dialog = new Y.Panel({
                        contentBox : Y.Node.create('<div id="dialog" />'),
                        bodyContent: '<div><div class="message icon-warn"></div> \
                                      <textarea style="width: 360px; height: 40px; font-size: 10px;" id="importText"></textarea> \
                                      </div>',
                        width      : 410,
                        zIndex     : 6,
                        centered   : true,
                        modal      : false, // modal behavior
                        render     : true,
                        visible    : false, // make visible explicitly with .show()
                        buttons    : {
                            footer: [
                                {
                                    name  : 'cancel',
                                    label : 'Cancel',
                                    action: 'onCancel'
                                },
                
                                {
                                    name     : 'proceed',
                                    label    : 'OK',
                                    action   : 'onOK'
                                }
                            ]
                        }
                    });
                    dialog.onCancel = function (e) {
                        e.preventDefault();
                        this.hide();
                        // the callback is not executed, and is
                        // callback reference removed, so it won't persist
                        this.callback = false;
                    }
                    dialog.onOK = function (e) {
                        e.preventDefault();
                        this.hide();
                        // code that executes the user confirmed action goes here
                        if (this.callback) {
                            this.callback();
                        }
                        // callback reference removed, so it won't persist
                        this.callback = false;
                    }
                }
            return dialog;
        };
    }());


    Y.extend(ChessBoard, Y.Widget, {
        initializer: function (config) {
            this.orientation = true; //true: white at the bottom.
            this.showCoordinates = false;
            this.enforceLegalMoves = true;
            this.disableMoves = false;
            if (config && config.orientation) {
                this.orientation = config.orientation;
            }
        },
        destructor: function () {this.cleanup();},
        cleanup: function(){ 
            //cleanup the drag handles
            //if(drags.destory){
              //  drags.destroy();
            //}
            //cleanup the pieces
            if(drops.each){
                drops.each(function (v) {
                    v.empty();
                });
            }
        },
        renderUI: function () {
            var position = this.get('position'),
                pieces = position.pieces,
                board = this.get('contentBox'),
                square, bl, sl;
            this.cleanup();
            if (!isRendered) {
                
                board.addClass("cBox");
                /* 
                 * Render the header ui here.
                 */
                hd = Y.Node.create('<div class="boardHeader"></div>');
                board.append(hd);

                /* 
                 * Render the sidebox ui here.
                 */
                //sidebox html 
                sl = Y.Node.create('<div class="sidebox"> \
                                    <div class="tab" style="display: block;"> \
                                      <div class="notation"></div> \
                                      <div class="movebuttons"> \
                                        <input type="button" value="|&lt;" class="notation_start"> \
                                        <input type="button" value="&lt;" class="notation_previous"> \
                                        <input type="button" value="&gt;" class="notation_next"> \
                                        <input type="button" value="&gt;|" class="notation_end"> \
                                      </div> \
                                      <div> \
                                        <input type="button" value="Initial Position" > \
                                        <input type="button" value="New Board"> \
                                        <input type="button" id="pasteFEN" value="Paste FEN"> \
                                        <input type="button" id="pastePGN" value="Paste PGN"> \
                                      </div> \
                                      <div> \
                                        <label><input type="checkbox" id="flipBoard"> Flip Board</label> \
                                        <label><input type="checkbox" id="showCoordinates"> Show coordinates</label> \
                                        <label><input type="checkbox" id="enforceLegalMoves"> Enforce Legal Moves</label> \
                                      </div> \
                                    </div> \
                                </div>');
                //set the initial state based on config.
                if (!this.orientation) {
                    sl.one('#flipBoard').setAttribute('checked', 'true');
                }
                if (this.showCoordinates) {
                    sl.one('#showCoordinates').setAttribute('checked', 'true');
                }
                if (this.enforceLegalMoves) {
                    sl.one('#enforceLegalMoves').setAttribute('checked', 'true');
                }

                sl.one('#flipBoard').on('change', this.flipBoard, this);

                sl.one('#showCoordinates').on('change', function (e) {
                    bl.all(".x_coor, .y_coor").toggleView();
                });
                sl.one('#enforceLegalMoves').on('change', function (e) {
                    this.enforceLegalMoves = (this.enforceLegalMoves) ? false : true;
                }, this);
                
                sl.one('#pasteFEN').on('click', this.showFPNDialog, this);
                sl.one('#pastePGN').on('click', this.showPGNDialog, this);
                sl.one(".notation").delegate('click',this.notationMoveClick, 'span', this);
                sl.one('.movebuttons').delegate('click',this.handleNotationButtonClicks, 'input[type=button]', this);

                board.append(sl);

                /* 
                 * Render the board ui here.
                 */
                //board holding the pieces
                bl = Y.Node.create('<div class="board"></div>');
                //Creating divs for the entire board to hold pieces or be empty.
                for (i = 0; i < 8; i++) {
                    code = String.fromCharCode(97 + i);
                    bl.append('<div class="col c' + code + '"></div>');
                    for (j = 8; j > 0; j--) {
                        square = Y.Node.create('<div class="square sq_' + code + j + '"></div>');
                        square.setData('square', {
                            x: code,
                            y: j,
                            sq: code + '' + j
                        });
                        bl.one('.c' + code).append(square);
                    }
                }
                bl.append('<div class="x_coor"><div>a</div><div>b</div><div>c</div><div>d</div><div>e</div><div>f</div><div>g</div><div>h</div></div> \
                           <div class="y_coor"><div>8</div><div>7</div><div>6</div><div>5</div><div>4</div><div>3</div><div>2</div><div>1</div></div>');
                board.append(bl);
                //set the intial state based on config.
                if (!this.orientation) {
                    this.flipBoard();
                }
                if (!this.showCoordinates) {
                    bl.all(".x_coor, .y_coor").toggleView();
                }
                
                //Bind all the squares as droppables.
                //these might ideally should have been in bindui, however they are not executed every time 
                //hence having it in renderui, that too with in isRendered function.
                drops = board.all('div.square');
                drops.each(function (v) {
                    new Y.DD.Drop({
                        node: v
                    })
                });
                isRendered = true;
            }

            /* 
             * Render the pieces ui here.
             */
            Y.Object.each(pieces, function (v, k) {
                if (v) {
                    v.render(board);
                }
            })
        },
        syncUI: function () {
        },
        bindUI: function () {
        	
        	//If moves are disabled then dont bind any drag drops.
        	if(this.isBinded){
        		return;
        	}
            // bind drag and drop for each piece.
            var bc = this,
                board = this.get('contentBox');
                
            position = this.get('position');
            drags = new Y.DD.Delegate({
                container: board,
                nodes: 'div.piece',
                target: false
            });

            // constraining drags to the board
            drags.dd.plug(Y.Plugin.DDConstrained, {
                //Keep it inside the board
                constrain2node: board.one(".board")
            }).plug(Y.Plugin.DDProxy, {
                //Don't move the node at the end of the drag
                moveOnEnd: false,
                borderStyle: 'none'
            });                        

            /*
             * drag start
             */
            Y.DD.DDM.on('drag:start', function (e) {
                //Get our drag object
                var drag = e.target,
                    piece_node = drag.get('node'),
                    square_node = piece_node.get('parentNode'),
                    drag_node = drag.get('dragNode'),
                    piece = {},
                    allowedMoves = {};
                
                //if the moves are disabled dont allow dragging.
                if(bc.disableMoves){
                	return false;
                }

                // Find the allowed moves
                piece = position.getPieceBySquare(square_node.getData('square').sq);

                if (!bc.enforceLegalMoves || position.toMove === piece.color) {
                    //Set some styles here
                    piece_node.setStyle('opacity', '.25');
                    drag_node.set('innerHTML', drag.get('node').get('innerHTML'));
                    drag_node.addClass('dpiece');
                    drag_node.setStyle('border', 'none');
                }

                //is this the color of the piece to move if not dont allow the move.
                if (bc.enforceLegalMoves && position.toMove === piece.color) {

                    //Set some styles here
                    piece_node.setStyle('opacity', '.25');

                    //calculate the allowed moves
                    allowedMoves = piece.getValidMoves(position);

                    // highlight the squares that are allowed.
                    Y.Array.each(allowedMoves.moves, function (v, k) {
                        board.one('.sq_' + v).addClass('allowedMove');

                    });
                    // highlight the squares that are allowed.
                    Y.Array.each(allowedMoves.captures, function (v, k) {
                        board.one('.sq_' + v).addClass('allowedCapture');
                    });

                    Y.Array.each(allowedMoves.castlemoves, function (v, k) {
                        board.one('.sq_' + v).addClass('allowedCastleMove');
                    });

                    drag_node.set('innerHTML', drag.get('node').get('innerHTML'));
                    drag_node.addClass('dpiece');
                    drag_node.setStyle('border', 'none');
                } else if (!bc.enforceLegalMoves) {
                    return true;
                } else {
                    return false;
                }

            });
            /*
             * drag end
             */
            Y.DD.DDM.on('drag:end', function (e) {
                var drag = e.target, state;
                //Put our styles back
                drag.get('node').setStyles({
                    visibility: '',
                    opacity: '1'
                });
                // cleaning up the proxy element so that it wont show up when a unallowed move is made.
                // dont think this is the right way but works
                drag.get('dragNode').empty();

                board.all('.allowedMove').removeClass('allowedMove');
                board.all('.allowedCapture').removeClass('allowedCapture');
                board.all('.allowedCastleMove').removeClass('allowedCastleMove');
                state = position.isGameOver();
                if (state) {
                    alert(state);
                    //remove dragabble and dropabbles.
                    //drags.destroy();
                    //drops.destroy();
                }

            });
            // on drop hit event
            Y.DD.DDM.on('drag:drophit', function (e) {
                var drop = e.drop.get('node'),
                    drag = e.drag.get('node'),
                    isEmpty = (drop.getContent) ? !drop.getContent() : !drop.getHTML(),
                    piece = position.getPieceBySquare(drag.get('parentNode').getData('square').sq),
                    data = e.drag.get('data'),
                    square = drop.getData('square'),
                    fullMoveNumber = (piece.color == 'w') ? position.fullMoveNumber:0,
                    rank = (piece.color == 'w') ? 8 : 1,
                    piecePosition = '', add, promotion_obj,move_text;
                
                //if piece is not a pawn or king check if we have to include detailed representation of piece in pgn move text.     
                if(piece.type != 'p' && piece.type != 'k'){
                	piecePosition = (position.isprotectedByPeer(square.x+square.y,piece)) ?  piece.x : '';
                }
                
                if(bc.disableMoves){
                	return false;
                }
                // have code to clean up existing pieces if any and then append.
                //@TODO: instead of relying on the class, call the valid moves function again.                
                if (!bc.enforceLegalMoves) {
                    drop.empty();
                    drop.appendChild(drag);
                } else if(piece.type == 'p' && rank == square.y && (drop.hasClass('allowedMove') || drop.hasClass('allowedCapture'))){
                    //handle pawn promotions
                    promotion_obj = { piece:Y.Object(piece), square:square, fullMoveNumber:fullMoveNumber};
                    bc.showPawnPromotionDialog(promotion_obj);
                    drop.empty();
                    drop.appendChild(drag);
                } else if (isEmpty && drop.hasClass('allowedMove')) {
                    drop.appendChild(drag);
                    move_text = (piece.type == 'p')? square.x+square.y : piece.type.toUpperCase()+piecePosition+square.x+square.y;
                    piece.movetoSquare(square, position);                 
                } else if (drop.hasClass('allowedCapture')) {
                    drop.empty();
                    drop.appendChild(drag);
                    //Handle enpassant captures for pawns.
                    if (piece.type == 'p' && isEmpty) {
                        piece.enpassantCapture(position);
                        add = (piece.color == 'w') ? -1 : 1;
                        board.one('.sq_' + square.x + (square.y + add)).empty();
                    }
                    move_text = (piece.type == 'p')? piece.x+'x'+square.x+square.y : piece.type.toUpperCase()+piecePosition+'x'+square.x+square.y;
                    piece.movetoSquare(square, position);
                    
                } else if (isEmpty && drop.hasClass('allowedCastleMove') && piece.type == 'k') {
                    drop.appendChild(drag);
                    rank = (piece.color == 'w') ? 1 : 8;
                    if (square.x == 'g') {
                        rook = position.getPieceBySquare('h' + rank);
                        rook.castlingRookMove({
                            x: 'f',
                            y: rank,
                            sq: 'f' + rank
                        }, position);
                        board.one('.sq_f' + rank).appendChild(board.one('.sq_h' + rank + ' .piece'));
                        board.one('.sq_h' + rank).empty();
                        move_text = 'O-O';
                    } else {
                        rook = position.getPieceBySquare('a' + rank);
                        rook.castlingRookMove({
                            x: 'd',
                            y: rank,
                            sq: 'd' + rank
                        }, position);
                        board.one('.sq_d' + rank).appendChild(board.one('.sq_a' + rank + ' .piece'));
                        board.one('.sq_a' + rank).empty();
                        move_text = 'O-O-O';
                    }
                    piece.movetoSquare(square, position);
                }
                if(move_text){
                    bc.updateNotation(move_text,position,fullMoveNumber);
                }
            });
            this.isBinded  = true;
        },
        flipBoard: function () {
            var board = this.get('contentBox');
            board.one(".board").toggleClass('flip');
            board.all('.square').toggleClass('flip');
            board.one(".x_coor").toggleClass('x_coor_flipped');
            board.one(".y_coor").toggleClass('y_coor_flipped');
            board.all(".y_coor>div, .x_coor>div").toggleClass('flip');
        },
        showFPNDialog: function () {
            var dialog = ChessBoard.getDialog(), bc = this, position = this.get('position');
            if(dialog){
               dialog.show();
               Y.one('#dialog .message').setHTML('Paste your FEN string in the following box and hit OK to apply it to the editor');
               dialog.callback = function(){
               position.importFEN(Y.one("#importText").get("value"));
               bc.renderer();
               }
            }
        },
        showPGNDialog: function () {
            var dialog = ChessBoard.getDialog(), bc = this;
            if(dialog){
               dialog.show();
               Y.one('#dialog .message').setHTML('Paste your PGN string in the following box and hit OK to apply it to the editor');
               dialog.callback = function(){
                   if(bc.cpgn){
                       bc.cpgn.importPGN(Y.one("#importText").get("value"));
                       bc.renderer();
                   }
               }
            }
        },
        setHeader:function(name,value){
            var board = this.get('contentBox');
            board.one(".boardHeader").append('<span class="chname">'+Y.Escape.html(name)+'</span><span class="chvalue">'+Y.Escape.html(value)+'</span>');
            
        },
        updateNotation:function(move,position,fullMoveNumber,noAppend){
            
            var notation_box = this.get('contentBox').one(".notation"), FEN = position.FEN, move_node, hmove = notation_box.one('.highlightedmove');
            
            if(position.isMate() && !noAppend){
                move = move+"#";
            } else if(position.isCheck() && !noAppend){
                move = move+"+";
            }
            if(fullMoveNumber){
            move_node = Y.Node.create('<span class="move">'+fullMoveNumber+'.&nbsp;'+move+'</span>');
            }
            else{
            move_node = Y.Node.create('<span class="move">'+move+'</span>');
            }
            move_node.setData('FEN',FEN);
            notation_box.append(move_node);
            if(hmove){
            	hmove.removeClass("highlightedmove");
            }
        },
        notationMoveClick:function(e){
            var node = e.currentTarget, fen = node.getData('FEN'), position = this.get('position');
            if(node.next("span")){
            	this.disableMoves = true;
            }else{
            	this.disableMoves = false;
            }
            position.importFEN(fen);
            this.renderer();
            e.container.all(".move").removeClass("highlightedmove");
            node.addClass("highlightedmove");
        },
        handleNotationButtonClicks:function(e){
            var button = e.currentTarget, type = button.getAttribute('class'), node, position;
            switch(type){
            case "notation_start":
            node = this.get('contentBox').one(".notation span:first-child");
            break;
            case "notation_end":
            node = this.get('contentBox').one(".notation span:last-child");
            break;
            case "notation_previous":
            node = this.get('contentBox').one(".highlightedmove").previous("span");
            break;
            default: //next
            node = this.get('contentBox').one(".highlightedmove").next("span");
            break;
            }
            if(node){
            	//disable piece movement unless until its the last move. 
            	//we might have to change this when we add analysis logic.
	            if(node.next("span")){
	            	this.disableMoves = true;
	            }else{
	            	this.disableMoves = false;
	            }
	            position = this.get('position');
	            position.importFEN(node.getData('FEN'));
	            this.renderer();
	            this.get('contentBox').one(".notation").all(".move").removeClass("highlightedmove");
	            node.addClass("highlightedmove");
            }
        },
        showPawnPromotionDialog:function(promotion_obj){
            var color = promotion_obj.piece.color, board = this.get('contentBox').one(".board");
            //@TODO: handle this better. instead of removing everytime, show/ hide.
            if(board.one(".promotion_wrapper")){
            board.removeChild(board.one(".promotion_wrapper"));
            }
            board.append('<div class="promotion_wrapper"><div class="promotion_box"><img src="icons/' + color + 'q.png" /><img src="icons/' + color + 'r.png" /><img src="icons/' + color + 'b.png" /><img src="icons/' + color + 'n.png" /></div></div>');
            board.one(".promotion_box").delegate('click',this.handlePawnPromotion, 'img', this, promotion_obj);
        },
        handlePawnPromotion: function(e,promotion_obj){
            var img = e.currentTarget, src=img.getAttribute("src"), promoted_piece, square = promotion_obj.square, piece=promotion_obj.piece,board = this.get('contentBox').one(".board");
            promoted_piece = position.promotePawn(piece.x,piece.y,square.x,square.y,src.charAt(src.length-5));
            promoted_piece.render(this.get('contentBox'));
            this.updateNotation(square.x+square.y+'='+promoted_piece.type.toUpperCase(),position,promotion_obj.fullMoveNumber);
            board.removeChild(board.one(".promotion_wrapper"));
        }

    });
    Y.ChessBoard = ChessBoard;
}, '0.0.1', {
    requires: ["node", "widget", "chess_position", "chess_piece_factory", 'dd-delegate', 'dd-proxy', 'dd-constrain', 'panel','node-event-delegate']
});

YUI().add('chess_position', function (Y) {

    var default_position = {
        a: [0, "wr", "wp", 0, 0, 0, 0, "bp", "br"],
        b: [0, "wn", "wp", 0, 0, 0, 0, "bp", "bn"],
        c: [0, "wb", "wp", 0, 0, 0, 0, "bp", "bb"],
        d: [0, "wq", "wp", 0, 0, 0, 0, "bp", "bq"],
        e: [0, "wk", "wp", 0, 0, 0, 0, "bp", "bk"],
        f: [0, "wb", "wp", 0, 0, 0, 0, "bp", "bb"],
        g: [0, "wn", "wp", 0, 0, 0, 0, "bp", "bn"],
        h: [0, "wr", "wp", 0, 0, 0, 0, "bp", "br"]
    };

    /* Chess Position Constructor */
    function ChessPosition(config) {
        ChessPosition.superclass.constructor.apply(this, arguments);
    }


    ChessPosition.NAME = "ChessPosition";

    Y.extend(ChessPosition, Y.Base, {
        initializer: function (config) {
            this.squares = default_position;
            this.toMove = 'w';
            this.pieces = {};
            this.castleRights = 15;
            this.enPassant = '';
            this.halfMoves = 0;
            this.fullMoveNumber = 1;
            this.FEN = '';
            this.checks = {};
            this.allMoves = {};
            this.validMoves = {};
            //cache references to white king and black king they are most used with in the code.
            this.wk = {};
            this.bk = {};
            this.setPieces();
            this.FEN = this.generateFEN();
        },
        destructor: function () {},
        isMate: function (stale) {
            var king, allmoves = {},
                pieces = {},
                color, allowed_moves = {};
            if (this.isCheck() || stale) {
                pieces = this.pieces;
                color = this.toMove;
                for (sq in pieces) {
                    piece = pieces[sq];
                    if (piece.color === color) {
                        allowed_moves = piece.getValidMoves(this);
                        if ((allowed_moves.moves && allowed_moves.moves.length) || (allowed_moves.captures && allowed_moves.captures.length)) {
                            return false;
                        }
                    }
                }
                return true;
            }
            return false;
        },
        isGameOver:function(){
            var status = false;
            if(this.isMate()){
                status = "Checkmate!";
            }else if(this.isMate(true)){
                status = "Stalemate!";                             
            }else if(this.isInsufficientMaterial()){
                status = "Draw! Because of Insufficient Material";
            }else if(this.isThreeFoldRepetition()){
                status = "Draw! Because of Repetition";
            }else if(this.halfMoves > 100){
                status = "Draw! Because of Half Moves";
            }
        },
        isThreeFoldRepetition:function(){
          return false;  
        },
        isInsufficientMaterial:function(){
          var p = this.pieces, piece,w={k:1,n:0,bl:0,bd:0},b={k:1,n:0,bl:0,bd:0}, bishop_type;
          for (sq in p){
              piece = p[sq];
              switch(piece.type){
                  case 'k':
                  break;
                  case 'q':
                  return false;
                  break;
                  case 'n':
                  (piece.color == 'w')?w['n']++ :b['n']++; 
                  break;
                  case 'r':
                  return false;
                  break;
                  case 'b':
                  (((piece.x.charCodeAt(0)-96)+piece.y)%2 == 0) ? bishop_type = 'd':'l';
                  (piece.color == 'w')?w['b'+bishop_type]++ :b['b'+bishop_type]++;
                  break;
                  default:
                  return false;
                  break;
              }
          }
          //only one knight of one of the colors is left
          if((w.n == 1 && ((w.bl+w.bd+b.n+b.bl+b.bd) == 0)) || (b.n == 1 && ((b.bl+b.bd+w.n+w.bl+w.bd) == 0))){
            return true;   
          }
          //only light squared bishops of one / both the colors is left.
          if((w.bl > 1 && ((w.n+w.bd+b.n+b.bd) == 0)) || (b.bl == 1 && ((b.n+b.bd+w.n+w.bd) == 0))){
            return true;   
          }
           //only dark squared bishops of one / both the colors is left.
          if((w.bd > 1 && ((w.n+w.bl+b.n+b.bl) == 0)) || (b.bd == 1 && ((b.n+b.bl+w.n+w.bl) == 0))){
            return true;   
          }
          
          return false;
              
        },
        isAmbiguousMove: function(piece,square){
            
        },
        setPieces: function () {
            // create the pieces from the squares.
            var sq = this.squares,
                i = 0,
                config = {},
                col = [],
                pieces = {};
            //@TODO: ensure the order 
            for (column in sq) {
                col = sq[column];
                for (i = 1; i <= 8; i++) {
                    if (col[i]) {
                        config = {
                            color: col[i].charAt(0),
                            type: col[i].charAt(1),
                            x: column,
                            y: i
                        };
                        pieces[column + config.y] = Y.ChessPieceFactory.getInstance(config);

                        //set the cached versions of wk and bk. 
                        if (config.type == 'k') {
                            this[config.color + 'k'] = pieces[column + config.y];
                        }
                    }
                }
            }
            this.pieces = pieces;
        },
        getPieceBySquare: function (square) {
            var p = this.pieces;
            return p[square];
        },
        getPiecesByName: function (piece) {
            var p = this.pieces,
                name = '',
                found_pieces = [];
            for (sq in p) {
                name = p[sq].color + p[sq].type;
                if (name === piece) {
                    found_pieces.push(p[sq]);
                }
            }
            return found_pieces;
        },
        makeMove: function (x1, y1, x2, y2, isCastledRookMove,promotedPiece) {
            var piece = (promotedPiece)?promotedPiece:this.pieces[x1 + y1],
                color = piece.color,
                old_piece = this.squares[x2][y2];
            delete(this.pieces[x1 + y1]);
            this.pieces[x2 + y2] = piece;
            this.squares[x1][y1] = 0;
            this.squares[x2][y2] = color + piece.type;
            this.enPassant = '';
            if (!isCastledRookMove) {
                if (color === 'b') {
                    this.toMove = 'w';
                    this.fullMoveNumber = parseInt(this.fullMoveNumber) + 1;
                } else {
                    this.toMove = 'b';
                }
                if (old_piece || piece.type == 'p' || promotedPiece) {
                    this.halfMoves = 0;
                } else {
                    this.halfMoves = this.halfMoves + 1;
                }
                //@TODO:simply update the existing FEN instead of regenerating it.
                this.FEN = this.generateFEN();
            }
        },
        promotePawn: function(x1,y1,x2,y2,type){
            var config = {
                type:type,
                color: this.toMove,
                x: x2,
                y: y2,
            },promoted_piece;                
            promoted_piece = Y.ChessPieceFactory.getInstance(config);
            this.makeMove(x1,y1,x2,y2,null,promoted_piece);

            return promoted_piece;
        },
        generateFEN: function () {
            var fen = '',
                sq = this.squares,
                i = 0,
                col = [],
                pieces = {},
                empty = 0,
                piece = '',
                color = '',
                castleRights = this.castleRights;

            for (i = 8; i >= 1; i--) {
                empty = 0;
                //@TODO: ensure the order
                for (column in sq) {
                    piece = sq[column][i];
                    if (piece) {
                        color = piece.charAt(0);
                        if (empty != 0) {
                            fen += empty;
                            empty = 0;
                        }
                        fen = (color === 'w') ? fen + piece.charAt(1).toUpperCase() : fen + piece.charAt(1);
                    } else {
                        empty++;
                    }
                }
                if (empty) {
                    fen += empty;
                }
                fen += '/';
            }
            fen = fen.slice(0, -1);
            fen += ((this.toMove === 'w') ? " w " : " b ");

            if (castleRights) {
                if ((castleRights & 1) != 0) fen += "K";
                if ((castleRights & 2) != 0) fen += "Q";
                if ((castleRights & 4) != 0) fen += "k";
                if ((castleRights & 8) != 0) fen += "q";
            } else {
                fen += " -";
            }
            fen += (this.enPassant) ? " " + this.enPassant : " -";
            fen += " " + this.halfMoves;
            fen += " " + this.fullMoveNumber;

            return fen;
        },
        importFEN: function (fen) {
            var fen_arr = fen.split(/\s+/),
                moves_arr = fen_arr[0].split('/'),
                sq = this.squares,
                len = 0,
                c = '',
                i, j, col,char_index;

            for (j=0;j<8;j++) {
                char_index = 0;
                for (i = 0; i < 8; i++) {
                    c = moves_arr[j].charAt(char_index);
                    col = String.fromCharCode(97+i);
                    if (c.charCodeAt(0) > 64) {
                        sq[col][8-j] = (c.charCodeAt(0) < 96) ? 'w' + c.toLowerCase() : 'b' + c;
                    } else {
                        c = parseInt(c);
                        for (k = 0; k < c; k++) {
                            sq[String.fromCharCode(97+i+k)][(8-j)] = 0;
                        }
                        i = i + c - 1;
                    }
                    char_index++;
                }
            }
            this.squares = sq;

            this.toMove = fen_arr[1];

            if (fen_arr[2].indexOf('K')) {
                this.castleRights = (this.castleRights | 1);
            }
            if (fen_arr[2].indexOf('Q')) {
                this.castleRights = (this.castleRights | 2);
            }
            if (fen_arr[2].indexOf('k')) {
                this.castleRights = (this.castleRights | 4);
            }
            if (fen_arr[2].indexOf('q')) {
                this.castleRights = (this.castleRights | 8);
            }

            if (fen_arr[3] != '-') {
                this.enPassant = fen_arr[3];
            }
            this.halfMoves = fen_arr[4];
            this.fullMoveNumber = fen_arr[5];
            this.setPieces();

        },
        isAllowedToCastle: function (color, side) {
            var castleRights = this.castleRights;
            switch (color + side) {
            case 'wk':
                return ((castleRights & 1) != 0);
            case 'wq':
                return ((castleRights & 2) != 0);
            case 'bk':
                return ((castleRights & 4) != 0);
            case 'bq':
                return ((castleRights & 8) != 0);
            default:
                return ((castleRights & 1) != 0);
            }

        },
        removeCastlingRight: function (color, side) {
            var castleRights = this.castleRights;
            switch (color + side) {
            case 'wk':
                castleRights = (castleRights & 14);
                break;
            case 'wq':
                castleRights = (castleRights & 13);
                break;
            case 'bk':
                castleRights = (castleRights & 11);
                break;
            case 'bq':
                castleRights = (castleRights & 7);
                break;
            default:
                castleRights = (castleRights & 14);
                break;
            }
            this.castleRights = castleRights;
        },
        removeEnpassantRight: function () {
            var squares = this.squares,
                pieces = this.pieces,
                ep = this.enPassant,
                x = ep.charAt(0),
                add = (this.toMove == 'w') ? -1 : 1,
                y = ep.charAt(1) + add;
            delete(pieces[x + y]);
            squares[x][y] = 0;
            this.squares = squares;
            this.pieces = pieces;
            this.enPassant = '';
        },
        //protected functions
        findProtectedSquares: function (color) {
            var position = this,
                pieces = position.pieces,
                squares = [],
                piece_squares = [],
                piece = {},
                allowed_moves = {},
                type, sq, si;
            for (sq in pieces) {
                allowed_moves = {};
                piece = pieces[sq];
                type = piece.type;
                piece_squares = [];
                //check if its protected by a pawn -- generally this will not be listed in the pawn moves
                if (piece.color === color) {
                    if (type !== 'p' && type !== 'k') {
                        allowed_moves = piece.getAllMoves(position);
                        piece_squares = piece_squares.concat(allowed_moves.moves, allowed_moves.captures, allowed_moves.protectedPieces);

                    } else {
                        allowed_moves = piece.findProtectedSquares(position);
                        piece_squares = piece_squares.concat(allowed_moves);
                    }
                }
                //though javascript array concat does not remove duplicates, I believe that should be fine here.
                squares = squares.concat(piece_squares);
            }
            return squares;
        },
        isprotectedByPeer: function(square,piece){
        	var position = this,
        		type = piece.type,
        		pieces = position.getPiecesByName(piece.color+type)
        		piece={},allowed_moves={},count=0,piece_squares = [],sq;
        		for(sq in pieces){
        			allowed_moves = {};
        			piece = pieces[sq],
                    type = piece.type;
                    piece_squares = [];
        			if (type !== 'p' && type !== 'k') {
                        allowed_moves = piece.getAllMoves(position);
                        //though javascript array concat does not remove duplicates, I believe that should be fine here.
                        piece_squares = piece_squares.concat(allowed_moves.moves, allowed_moves.captures, allowed_moves.protectedPieces);
                        if (Y.Array.indexOf(piece_squares, square) !== -1) {
                            count++;
                            if(count > 1) return true;
                        }
                    } else {
                        allowed_moves = piece.findProtectedSquares(position);
                        piece_squares = piece_squares.concat(allowed_moves);
                        if (Y.Array.indexOf(piece_squares, square) !== -1) {
                            count++;
                            if(count > 1) return true;
                        }
                    }
        		}
        		return false;
        },
        isSquareProtected: function (square, color) {
            var position = this,
                pieces = position.pieces,
                piece_squares = [],
                piece = {},
                allowed_moves = {},
                type, sq, si;
            for (sq in pieces) {
                allowed_moves = {};
                piece = pieces[sq];
                type = piece.type;
                piece_squares = [];
                //check if its protected by a pawn -- generally this will not be listed in the pawn moves
                if (piece.color === color) {
                    if (type !== 'p' && type !== 'k') {
                        allowed_moves = piece.getAllMoves(position);
                        //though javascript array concat does not remove duplicates, I believe that should be fine here.
                        piece_squares = piece_squares.concat(allowed_moves.moves, allowed_moves.captures, allowed_moves.protectedPieces);
                        if (Y.Array.indexOf(piece_squares, square) !== -1) {
                            return piece;
                        }
                    } else {
                        allowed_moves = piece.findProtectedSquares(position);
                        piece_squares = piece_squares.concat(allowed_moves);
                        if (Y.Array.indexOf(piece_squares, square) !== -1) {
                            return piece;
                        }
                    }
                }
            }
            return false;
        },
        isCheck: function () {
            var checks = this.checks,
                fen = this.FEN,
                color, opposite_color, king, piece, slope, xdiff, ydiff;
            if (typeof (checks[fen]) == 'undefined') {
                color = this.toMove;
                opposite_color = (color === 'w') ? 'b' : 'w';
                king = this[color + 'k'];
                piece = this.isSquareProtected(king.x + king.y, opposite_color)
                if (piece) {
                    checks[fen] = piece.x + piece.y;
                } else {
                    checks[fen] = 0
                }
            }
            return checks[fen];
        },
        isPinned: function (square) {
            var position = this,
                piece_types = ['b', 'r', 'q'],
                pieces = [],
                allowed_moves = {},
                color = this.toMove,
                opposite_color = (color === 'w') ? 'b' : 'w',
                piece, i, j, len;

            for (i = 0; i < 3; i++) {
                pieces = this.getPiecesByName(opposite_color + piece_types[i]);
                for (j = 0, len = pieces.length; j < len; j++) {
                    if (pieces[j].isPinning(square, position)) {
                        return pieces[j];
                    }
                }
            }
            return false;
        }
    });
    Y.ChessPosition = ChessPosition;
}, '0.0.1', {
    requires: ["node", "base", "chess_piece_factory"]
});

YUI().add('chess_piece', function (Y) {

    /* Chess Piece Constructor */
    function ChessPiece(config) {
        ChessPiece.superclass.constructor.apply(this, arguments);
    }


    ChessPiece.NAME = "ChessPiece";

    Y.extend(ChessPiece, Y.Base, {
        initializer: function (config) {
            this.color = 'w';
            this.x = null;
            this.y = null;
            this.type = 'p';
            if (config && config.color) {
                this.color = config.color;
            }
            if (config && config.x) {
                this.x = config.x;
            }
            if (config && config.y) {
                this.y = config.y;
            }
            if (config && config.type) {
                this.type = config.type;
            }
        },
        destructor: function () {},
        findAllMoves: function (position) {

        },
        getAllMoves: function (position) {
            var sq = this.x + this.y,
                fen = position.FEN;

            if (!position.allMoves[fen]) {
                position.allMoves[fen] = {};
            }
            if (!position.allMoves[fen][sq]) {
                position.allMoves[fen][sq] = this.findAllMoves(position);
            }
            return position.allMoves[fen][sq];
        },
        getValidMoves: function (position) {
            var sq = this.x + this.y,
                fen = position.FEN,
                filterMoves = function (moves) {
                    var valid_moves = [],
                        temp_slope, xdiff, ydiff, len, i, mx, my, between;

                    for (i = 0, len = moves.length; i < len; i++) {
                        my = moves[i].charAt(1);
                        mx = moves[i].charCodeAt(0);
                        ydiff = my - ky;
                        xdiff = mx - kx;
                        if (sxdiff) {
                            between = (sxdiff > 0) ? (sxdiff >= xdiff) : (sxdiff <= xdiff);
                            if ((sydiff / sxdiff) == (ydiff / xdiff) && between) {
                                valid_moves.push(moves[i]);
                            }
                        } else if (xdiff == 0) {
                            between = (sydiff > 0) ? (sydiff >= ydiff) : (sydiff <= ydiff);
                            if (between) {
                                valid_moves.push(moves[i]);
                            }
                        }
                    }
                    return valid_moves;
                },
                check, color, king, allmoves, piece, pinningPiece, ky, kx, sxdiff, sydiff;

            if (!position.validMoves[fen]) {
                position.validMoves[fen] = {};
            }

            if (!position.validMoves[fen][sq]) {
                check = position.isCheck();
                color = this.color;
                king = position[color + 'k'];
                allmoves = this.getAllMoves(position);
                piece = {};
                pinningPiece = {};
                ky = king.y;
                kx = king.x.charCodeAt(0);

                if (this.type != 'k') {
                    if (check) {
                        piece = position.getPieceBySquare(check);
                        sydiff = check.charAt(1) - ky;
                        sxdiff = check.charCodeAt(0) - kx;
                        if (piece.type != 'n') {
                            allmoves.moves = filterMoves(allmoves.moves);
                            allmoves.captures = filterMoves(allmoves.captures);
                        } else {
                            allmoves.moves = [];
                            if (Y.Array.indexOf(allmoves.captures, check) !== -1) {
                                allmoves.captures = [check];
                            } else {
                                allmoves.captures = [];
                            }
                        }
                    }
                    pinningPiece = position.isPinned(this.x + this.y);
                    if (pinningPiece) {
                        sydiff = pinningPiece.y - ky;
                        sxdiff = pinningPiece.x.charCodeAt(0) - kx;
                        allmoves.moves = filterMoves(allmoves.moves);
                        allmoves.captures = filterMoves(allmoves.captures);
                    }
                }
                position.validMoves[fen][sq] = allmoves;
            }

            return position.validMoves[fen][sq];
        },
        movetoSquare: function (square, position) {
            position.makeMove(this.x, this.y, square.x, square.y);
            this.x = square.x;
            this.y = square.y;
            this.getAllMoves(position);
        },
        render: function (board) {
            var type = this.type,
                color = this.color,
                x = this.x,
                y = this.y,
                piece_node;
            piece_node = Y.Node.create('<div class="piece ' + color + 'piece ' + color + type + '"><span></span><img src="icons/' + color + type + '.png" /></div>');
            board.one(".sq_" + x + y).empty();
            board.one(".sq_" + x + y).append(piece_node);
        },
        isPinning: function (square, position) {
            return false;
        }
    });

    /* Allowed Moves function used to create a allowed_moves object for a given position for a piece*/
    ChessPiece.AllMoves = function (position, color) {
        var squares = position.squares;
        this.moves = new Array(), this.captures = new Array(), this.protectedPieces = new Array();
        this.updateMoves = function (x, y) {
            var piece_code = squares[x][y];
            if (piece_code === 0) {
                this.moves.push(x + y);
                return 1;
            } else if (piece_code.charAt(0) !== color) {
                this.captures.push(x + y);
                return 0;
            } else {
                this.protectedPieces.push(x + y);
                return -1;
            }
        };
    };

    Y.ChessPiece = ChessPiece;
}, '0.0.1', {
    requires: ["node", "base"]
});

YUI().add('chess_piece_pawn', function (Y) {
    /* Chess Piece Pawn Constructor */
    function ChessPiecePawn(config) {
        ChessPiecePawn.superclass.constructor.apply(this, arguments);
    }


    ChessPiecePawn.NAME = "ChessPiecePawn";

    Y.extend(ChessPiecePawn, Y.ChessPiece, {
        findAllMoves: function (position) {
            var x = this.x,
                y = this.y,
                color = this.color,
                moves = [],
                captures = [],
                protectedPieces = [],
                squares = position.squares,
                dg1 = x.charCodeAt(0) - 1,
                dg2 = x.charCodeAt(0) + 1,
                dg1_str = '',
                dg2_str = '',
                opposite_color = (color == 'w') ? 'b' : 'w',
                ep = position.enPassant,
                mul, prank, epsquare;

            if (color == 'w') {
                mul = 1;
                prank = 2;
                epsquare = 6;
            } else {
                mul = -1;
                prank = 7
                epsquare = 3;
            }

            if (squares[x][y + 1 * mul] === 0) {
                moves.push(x + (y + 1 * mul));
            }
            if (squares[x][y + 1 * mul] === 0 && squares[x][y + 2 * mul] === 0 && y == prank) {
                moves.push(x + (y + 2 * mul));
            }
            if (dg1 >= 97) {
                dg1_str = squares[String.fromCharCode(dg1)][y + 1 * mul];
                if (dg1_str) {
                    (dg1_str.charAt(0) === opposite_color) ? captures.push(String.fromCharCode(dg1) + (y + 1 * mul)) : protectedPieces.push(String.fromCharCode(dg1) + (y + 1 * mul));
                }
            }

            if (dg2 <= 104) {
                dg2_str = squares[String.fromCharCode(dg2)][y + 1 * mul];
                if (dg2_str) {
                    (dg2_str.charAt(0) === opposite_color) ? captures.push(String.fromCharCode(dg2) + (y + 1 * mul)) : protectedPieces.push(String.fromCharCode(dg2) + (y + 1 * mul));
                }
            }

            if (ep && (ep.charAt(1) == epsquare) && (dg1 == ep.charCodeAt(0) || dg2 == ep.charCodeAt(0)) && y == (epsquare - 1 * mul)) {
                captures.push(String.fromCharCode(ep.charCodeAt(0)) + epsquare);
            }

            return {
                moves: moves,
                captures: captures,
                protectedPieces: protectedPieces
            };
        },
        findProtectedSquares: function (position) {
            var x = this.x,
                y = this.y,
                color = this.color,
                moves = [],
                dg1 = x.charCodeAt(0) - 1,
                dg2 = x.charCodeAt(0) + 1,
                dg1_str = '',
                dg2_str = '';

            if (color == 'w') {
                if (dg1 >= 97) {
                    moves.push(String.fromCharCode(dg1) + (y + 1));
                }
                if (dg2 <= 104) {
                    moves.push(String.fromCharCode(dg2) + (y + 1));
                }
            } else {
                if (dg1 >= 97) {
                    moves.push(String.fromCharCode(dg1) + (y - 1));
                }

                if (dg2 <= 104) {
                    moves.push(String.fromCharCode(dg2) + (y - 1));
                }
            }
            return moves;
        },
        enpassantCapture: function (position) {
            position.removeEnpassantRight();
        },
        movetoSquare: function (square, position) {
            var diff = square.y - this.y,
                add = (this.color == 'w') ? 1 : -1;
            diff = (diff * add);
            ChessPiecePawn.superclass.movetoSquare.call(this, square, position);
            if (diff == 2) {
                position.enPassant = square.x + (square.y - add);
            }
        }
    });
    Y.ChessPiecePawn = ChessPiecePawn;
}, '0.0.1', {
    requires: ["node", "chess_piece"]
});

YUI().add('chess_piece_rook', function (Y) {
    /* Chess Piece Rook Constructor */
    function ChessPieceRook(config) {
        ChessPieceRook.superclass.constructor.apply(this, arguments);
    }


    ChessPieceRook.NAME = "ChessPieceRook";

    Y.extend(ChessPieceRook, Y.ChessPiece, {
        findAllMoves: function (position) {
            var x = this.x,
                y = this.y,
                color = this.color,
                i = 1,
                xc = x.charCodeAt(0),
                piece_code = '',
                allowed_moves = new Y.ChessPiece.AllMoves(position, color);

            for (i = 1; y + i <= 8; i++) {
                if (allowed_moves.updateMoves(x, y + i) <= 0) {
                    break;
                }
            }
            for (i = 1; y - i >= 1; i++) {
                if (allowed_moves.updateMoves(x, y - i) <= 0) {
                    break;
                }
            }
            for (i = 1; xc + i <= 104; i++) {
                if (allowed_moves.updateMoves(String.fromCharCode(xc + i), y) <= 0) {
                    break;
                }
            }
            for (i = 1; xc - i >= 97; i++) {
                if (allowed_moves.updateMoves(String.fromCharCode(xc - i), y) <= 0) {
                    break;
                }
            }

            return allowed_moves;
        },
        isPinning: function (square, position) {
            var opposite_color = (this.color === 'w') ? 'b' : 'w',
                king = position[opposite_color + 'k'],
                pieces = position.pieces,
                ky = king.y,
                kx = king.x.charCodeAt(0),
                y = this.y,
                x = this.x.charCodeAt(0),
                sy = square.charAt(1),
                sx = square.charCodeAt(0),
                i, j, from, diff;
            if (x === kx && x === sx && ((y < sy < ky) || (y > sy > ky))) {
                from = (y < ky) ? y : ky;
                diff = (y - ky);
                diff = (diff > 0) ? diff : -1 * diff;
                for (i = diff - 1; i > 0; i--) {
                    sq = String.fromCharCode(x) + (from + i);
                    if ((sq != square) && pieces[sq]) {
                        return false;
                    }
                }
                return true;
            } else if (y === ky && y === sy && ((x < sx < kx) || (x > sx > kx))) {
                from = (x < kx) ? x : kx;
                diff = (x - kx)
                diff = (diff > 0) ? diff : -1 * diff;
                for (i = diff - 1; i > 0; i--) {
                    sq = String.fromCharCode(from + i) + y;
                    if ((sq != square) && pieces[sq]) {
                        return false;
                    }
                }
                return true;
            }

            return false;
        },
        movetoSquare: function (square, position) {
            var current_square = this.x + this.y,
                color = this.color,
                rank = (color == 'w') ? 1 : 8;

            if (current_square == ('a' + rank) && position.isAllowedToCastle(color, 'q')) {
                position.removeCastlingRight(color, 'q');
            }
            if (current_square == ('h' + rank) && position.isAllowedToCastle(color, 'k')) {
                position.removeCastlingRight(color, 'k');
            }

            ChessPieceRook.superclass.movetoSquare.call(this, square, position);
        },
        castlingRookMove: function (square, position) {
            position.makeMove(this.x, this.y, square.x, square.y, 1);
            this.x = square.x;
            this.y = square.y;
        }
    });
    Y.ChessPieceRook = ChessPieceRook;
}, '0.0.1', {
    requires: ["node", "chess_piece"]
});

YUI().add('chess_piece_bishop', function (Y) {
    /* Chess Piece Bishop Constructor */
    function ChessPieceBishop(config) {
        ChessPieceBishop.superclass.constructor.apply(this, arguments);
    }


    ChessPieceBishop.NAME = "ChessPieceBishop";

    Y.extend(ChessPieceBishop, Y.ChessPiece, {
        findAllMoves: function (position) {
            var x = this.x,
                y = this.y,
                color = this.color,
                i = 1,
                xc = x.charCodeAt(0),
                piece_code = '',
                allowed_moves = new Y.ChessPiece.AllMoves(position, color);

            for (i = 1;
            (y + i <= 8) && (xc + i <= 104); i++) {
                if (allowed_moves.updateMoves(String.fromCharCode(xc + i), y + i) <= 0) {
                    break;
                }
            }
            for (i = 1;
            (y - i >= 1) && (xc - i >= 97); i++) {
                if (allowed_moves.updateMoves(String.fromCharCode(xc - i), y - i) <= 0) {
                    break;
                }
            }
            for (i = 1;
            (y - i >= 1) && (xc + i <= 104); i++) {
                if (allowed_moves.updateMoves(String.fromCharCode(xc + i), y - i) <= 0) {
                    break;
                }
            }
            for (i = 1;
            (y + i <= 8) && (xc - i >= 97); i++) {
                if (allowed_moves.updateMoves(String.fromCharCode(xc - i), y + i) <= 0) {
                    break;
                }
            }

            return allowed_moves;
        },
        isPinning: function (square, position) {
            var opposite_color = (this.color === 'w') ? 'b' : 'w',
                king = position[opposite_color + 'k'],
                pieces = position.pieces,
                ky = king.y,
                kx = king.x.charCodeAt(0),
                y = this.y,
                x = this.x.charCodeAt(0),
                sy = square.charAt(1),
                sx = square.charCodeAt(0),
                ydiff = y - sy,
                xdiff = x - sx,
                kydiff = y - ky,
                kxdiff = x - kx,
                slope, i, j, from, diff;

            if (xdiff && kxdiff) {
                slope = ydiff / xdiff;
                kslope = kydiff / kxdiff;
                if ((slope === 1 || slope === -1) && (kslope === slope) && ((y < sy < ky) || (y > sy > ky))) {
                    from = (y < ky) ? y : ky;
                    diff = (y - ky);
                    diff = (diff > 0) ? diff : -1 * diff;
                    for (i = diff - 1; i > 0; i--) {
                        sq = String.fromCharCode(x + (i * slope)) + (from + (i * slope));
                        if ((sq != square) && pieces[sq]) {
                            return false;
                        }
                    }
                    return true;
                }
            }
            return false;
        }
    });
    Y.ChessPieceBishop = ChessPieceBishop;
}, '0.0.1', {
    requires: ["node", "chess_piece"]
});

YUI().add('chess_piece_knight', function (Y) {
    /* Chess Piece knight Constructor */
    function ChessPieceKnight(config) {
        ChessPieceKnight.superclass.constructor.apply(this, arguments);
    }


    ChessPieceKnight.NAME = "ChessPieceKnight";

    Y.extend(ChessPieceKnight, Y.ChessPiece, {
        findAllMoves: function (position) {
            var x = this.x,
                y = this.y,
                color = this.color,
                xc = x.charCodeAt(0),
                piece_code = '',
                allowed_moves = new Y.ChessPiece.AllMoves(position, color);

            if ((y - 2) >= 1) {
                if ((xc + 1) <= 104) {
                    allowed_moves.updateMoves(String.fromCharCode(xc + 1), y - 2);
                }
                if ((xc - 1) >= 97) {
                    allowed_moves.updateMoves(String.fromCharCode(xc - 1), y - 2);
                }
            }
            if ((y + 2) <= 8) {
                if ((xc + 1) <= 104) {
                    allowed_moves.updateMoves(String.fromCharCode(xc + 1), y + 2);
                }
                if ((xc - 1) >= 97) {
                    allowed_moves.updateMoves(String.fromCharCode(xc - 1), y + 2);
                }
            }

            if ((y - 1) >= 1) {
                if ((xc + 2) <= 104) {
                    allowed_moves.updateMoves(String.fromCharCode(xc + 2), y - 1);
                }
                if ((xc - 2) >= 97) {
                    allowed_moves.updateMoves(String.fromCharCode(xc - 2), y - 1);
                }
            }
            if ((y + 1) <= 8) {
                if ((xc + 2) <= 104) {
                    allowed_moves.updateMoves(String.fromCharCode(xc + 2), y + 1);
                }
                if ((xc - 2) >= 97) {
                    allowed_moves.updateMoves(String.fromCharCode(xc - 2), y + 1);
                }
            }

            return allowed_moves;
        }
    });
    Y.ChessPieceKnight = ChessPieceKnight;
}, '0.0.1', {
    requires: ["node", "chess_piece"]
});

YUI().add('chess_piece_queen', function (Y) {

    /* Private variables */
    var r, b;
    /* Chess Piece Queen Constructor */
    function ChessPieceQueen(config) {
        ChessPieceQueen.superclass.constructor.apply(this, arguments);
    }


    ChessPieceQueen.NAME = "ChessPieceQueen";

    Y.extend(ChessPieceQueen, Y.ChessPiece, {
        findAllMoves: function (position) {
            var config = {
                color: this.color,
                x: this.x,
                y: this.y
            },
                r = new Y.ChessPieceRook(config),
                b = new Y.ChessPieceBishop(config),
                ra = r.findAllMoves(position),
                ba = b.findAllMoves(position),
                moves = ra.moves.concat(ba.moves),
                captures = ra.captures.concat(ba.captures),
                protectedPieces = ra.protectedPieces.concat(ba.protectedPieces);
            return {
                moves: moves,
                captures: captures,
                protectedPieces: protectedPieces
            };
        },
        isPinning: function (square, position) {
            var config = {
                color: this.color,
                x: this.x,
                y: this.y
            },
                r = new Y.ChessPieceRook(config),
                b = new Y.ChessPieceBishop(config);
            return (r.isPinning(square, position) || b.isPinning(square, position));
        }
    });
    Y.ChessPieceQueen = ChessPieceQueen;
}, '0.0.1', {
    requires: ["node", "chess_piece", "chess_piece_rook", "chess_piece_bishop"]
});

YUI().add('chess_piece_king', function (Y) {
    /* Chess Piece king Constructor */
    function ChessPieceKing(config) {
        ChessPieceKing.superclass.constructor.apply(this, arguments);
    }


    ChessPieceKing.NAME = "ChessPieceKing";

    Y.extend(ChessPieceKing, Y.ChessPiece, {
        findAllMoves: function (position) {
            var x = this.x,
                y = this.y,
                color = this.color,
                castlemoves = [],
                moves = [],
                captures = [],
                xc = x.charCodeAt(0),
                piece_code = '',
                i = -1,
                allowed_moves = new Y.ChessPiece.AllMoves(position, color),
                opposite_color = (color === 'w') ? 'b' : 'w',
                protected_squares = [],
                squares = position.squares,
                rank = (color == 'w') ? 1 : 8;

            for (i = -1; i < 2; i++) {
                if ((xc + i <= 104) && (xc + i >= 97)) {
                    allowed_moves.updateMoves(String.fromCharCode(xc + i), y)
                    if (y - 1 >= 1) {
                        allowed_moves.updateMoves(String.fromCharCode(xc + i), y - 1)
                    }
                    if (y + 1 <= 8) {
                        allowed_moves.updateMoves(String.fromCharCode(xc + i), y + 1)
                    }
                }
            }
            protected_squares = position.findProtectedSquares(opposite_color);
            //check if castling is possible, if yes highlight those squares.
            if (position.isAllowedToCastle(color, 'k') && !position.isCheck()) {
                if (!squares['f'][rank] && !squares['g'][rank]) {
                    if ((Y.Array.indexOf(protected_squares, ('f' + rank)) === -1) && (Y.Array.indexOf(protected_squares, ('g' + rank)) === -1)) {
                        castlemoves.push('g' + rank);
                    }
                }
            }
            if (position.isAllowedToCastle(color, 'q') && !position.isCheck()) {
                if (!squares['d'][rank] && !squares['c'][rank]) {
                    if ((Y.Array.indexOf(protected_squares, ('d' + rank)) === -1) && (Y.Array.indexOf(protected_squares, ('c' + rank)) === -1)) {
                        castlemoves.push('c' + rank);
                    }
                }
            }

            // ensure that no allowed moves are protected squares by other pieces.
            Y.Array.each(allowed_moves.moves, function (value, key) {
                if (Y.Array.indexOf(protected_squares, value) === -1) {
                    moves.push(value);
                }
            });
            Y.Array.each(allowed_moves.captures, function (value, key) {
                if (Y.Array.indexOf(protected_squares, value) === -1) {
                    captures.push(value);
                }
            });
            return {
                moves: moves,
                captures: captures,
                castlemoves: castlemoves,
                protectedPieces: allowed_moves.protectedPieces
            };
        },
        findProtectedSquares: function (position) {
            var x = this.x,
                y = this.y,
                color = this.color,
                xc = x.charCodeAt(0),
                piece_code = '',
                i = -1,
                moves = [];
            for (i = -1; i < 2; i++) {
                if ((xc + i <= 104) && (xc + i >= 97)) {
                    moves.push(String.fromCharCode(xc + i) + y);
                    if (y - 1 >= 1) {
                        moves.push(String.fromCharCode(xc + i) + (y - 1));
                    }
                    if (y + 1 <= 8) {
                        moves.push(String.fromCharCode(xc + i) + (y + 1));
                    }
                }
            }
            return moves;
        },
        movetoSquare: function (square, position) {
            var color = this.color,
                rank = (color == 'w') ? 1 : 8;

            if (position.isAllowedToCastle(color, 'q')) {
                position.removeCastlingRight(color, 'q');
            }
            if (position.isAllowedToCastle(color, 'k')) {
                position.removeCastlingRight(color, 'k');
            }
            ChessPieceKing.superclass.movetoSquare.call(this, square, position);
        }
    });
    Y.ChessPieceKing = ChessPieceKing;
}, '0.0.1', {
    requires: ["node", "chess_piece", "base"]
});

YUI().add('chess_piece_factory', function (Y) {

    var ChessPieceFactory = {};

    //Factory method to create the piece and return it back.
    ChessPieceFactory.getInstance = function (config) {
        if (config && config.type) {
            switch (config.type) {
            case "r":
                return new Y.ChessPieceRook(config);
                break;
            case "b":
                return new Y.ChessPieceBishop(config);
                break;
            case "n":
                return new Y.ChessPieceKnight(config);
                break;
            case "k":
                return new Y.ChessPieceKing(config);
                break;
            case "q":
                return new Y.ChessPieceQueen(config);
                break;
            default:
                return new Y.ChessPiecePawn(config);
                break;
            }
        }
    }

    Y.ChessPieceFactory = ChessPieceFactory;
}, '0.0.1', {
    requires: ["chess_piece_pawn", "chess_piece_rook", "chess_piece_bishop", "chess_piece_knight", "chess_piece_king", "chess_piece_queen"]
});