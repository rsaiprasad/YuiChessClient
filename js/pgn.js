/*
 * credits to chess.js for the png import function.
 * @TODO: conver as much as this part to yui.
 */
YUI().add('chess_pgn', function(Y) {
    /* private variables */ newline_char = '\n', possible_results = "1-0,0-1,1/2-1/2", default_fen = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

    /* Chess Position Constructor */
    function ChessPGN(config) {
        ChessPGN.superclass.constructor.apply(this, arguments);
    }


    ChessPGN.NAME = "ChessPGN";
    ChessPGN.NS = 'cpgn';

    Y.extend(ChessPGN, Y.Plugin.Base, {
        importPGN : function(pgn) {

            var regex = new RegExp('^(\\[(.|' + this.mask(newline_char) + ')*\\])' + '(' + this.mask(newline_char) + ')*' + '1\.(' + this.mask(newline_char) + '|.)*$', 'g'), board = this.get("host"), position = board.get('position'), half_move = 0, full_move = 1;

            /* get header part of the PGN file */
            var header_string = pgn.replace(regex, '$1');

            /* no info part given, begins with moves */
            if(header_string[0] != '[') {
                header_string = '';
            }

            /* we can call the board renderer function which would take care of this, we would just update the position object on importing the pgn */
            //reset();

            /* parse PGN header */
            var headers = this.parsePGNHeader(header_string);
            for(var key in headers) {
                board.setHeader(key, headers[key]);
            }

            /* delete header to get the moves */
            var ms = pgn.replace(header_string, '').replace(new RegExp(this.mask(newline_char), 'g'), ' ');

            /* delete comments */
            ms = ms.replace(/(\{[^}]+\})+?/g, '');

            /* delete move numbers */
            ms = ms.replace(/\d+\./g, '');

            /* trim and get array of moves */
            var moves = Y.Lang.trim(ms).split(new RegExp(/\s+/));

            /* set initial position */
            if((headers['SetUp'] && headers['SetUp'] == 1 && headers['FEN']) || ( typeof (headers['SetUp']) == 'undefined' && headers['FEN'])) {
                position.importFEN(headers['FEN']);
            } else {
                position.importFEN(default_fen);
            }

            /* delete empty entries */
            moves = moves.join(",").replace(/,,+/g, ',').split(",");
            var move = '';

            for( half_move = 0, full_move = 1; half_move < moves.length - 1; half_move++) {
                /* move not possible! (don't clear the board to examine to show the
                 * latest valid position)
                 */
                move = Y.Lang.trim(moves[half_move]);
                if(!this.updatePosition(move, position)) {
                    return false;
                } else {
                    if(half_move % 2 == 0) {
                        board.updateNotation(move,position,full_move,1);
                        full_move++;
                    } else {
                        board.updateNotation(move,position,0,1);
                    }

                }
            }

            /* examine last move */
            move = moves[moves.length - 1];
            if(Y.Array.indexOf(possible_results, move) > -1) {
                if(has_keys(header) && typeof header.Result == 'undefined') {
                    board.setHeader('Result', move);
                }
            } else {
                if(!this.updatePosition(Y.Lang.trim(moves[half_move]), board.get('position'))) {
                    return false;
                }
            }

            return true;
        },
        mask : function(str) {
            return str.replace(/\n/g, '\\n');
        },
        /* convert a move from Standard Algebraic Notation (SAN) to 0x88
         * coordinates
         */
        updatePosition : function(move, position) {
            var parse = move.match(/^([NBKRQ])?([abcdefgh12345678][12345678]?)?(x)?([abcdefgh][12345678])(=[NBRQ])?/), toMove = position.toMove, rank = (toMove == 'w') ? 1 : 8, piece = {}, square = {}, possible_pieces = [], valid_moves = {}, i, length;
            if(move.slice(0, 5) == 'O-O-O') {
                piece = position[toMove + 'k'];
                square = {
                    x : 'c',
                    y : rank,
                    sq : 'c'+rank
                };
                valid_moves = piece.getValidMoves(position);
                if(Y.Array.indexOf(valid_moves.castlemoves, square.sq) !== -1) {
                    rook = position.getPieceBySquare('a' + rank);
                    rook.castlingRookMove({
                        x : 'd',
                        y : rank,
                        sq : 'd' + rank
                    }, position);

                    piece.movetoSquare(square, position);
                    return true;
                }

            } else if(move.slice(0, 3) == 'O-O') {
                piece = position[toMove + 'k'];
                square = {
                    x : 'g',
                    y : rank,
                    sq : 'g'+rank
                };
                valid_moves = piece.getValidMoves(position);
                if(Y.Array.indexOf(valid_moves.castlemoves, square.sq) !== -1) {
                    rook = position.getPieceBySquare('h' + rank);
                    rook.castlingRookMove({
                        x : 'f',
                        y : rank,
                        sq : 'f' + rank
                    }, position);
                    piece.movetoSquare(square, position);
                    return true;
                }

            } else if(parse) {
                piece_type = (parse[1]) ? parse[1].toLowerCase() : 'p';
                isCapture = (parse[3]) ? 1 : 0;
                square = {
                    x : parse[4].charAt(0),
                    y : parseInt(parse[4].charAt(1)),
                    sq : parse[4]
                };
                possible_pieces = position.getPiecesByName(toMove + piece_type);
                length = possible_pieces.length;
                for( i = 0; i < length; i++) {
                    valid_moves = possible_pieces[i].getValidMoves(position);
                    if(parse[2] && ((possible_pieces[i].x + possible_pieces[i].y).indexOf(parse[2]) !== -1)) {
                        piece = possible_pieces[i];
                        break;
                    } else if(!parse[2] && (Y.Array.indexOf(valid_moves.moves, parse[4]) !== -1) || ((Y.Array.indexOf(valid_moves.captures, parse[4]) !== -1) && isCapture)) {
                        piece = possible_pieces[i];
                        break;
                    }
                }

                if(piece.movetoSquare) {
                    if(piece_type == 'p' && isCapture && (position.squares[parse[4]] === 0)) {
                        piece.enpassantCapture(position);
                    }
                    piece.movetoSquare(square, position);
                    return true;
                }
            }
            return false;
        },
        parsePGNHeader : function(header) {
            var header_obj = {};
            var headers = header.split(newline_char);
            var key = '';
            var value = '';

            for(var i = 0; i < headers.length; i++) {
                key = headers[i].replace(/^\[([A-Z][A-Za-z]*)\s.*\]$/, '$1');
                value = headers[i].replace(/^\[[A-Za-z]+\s"(.*)"\]$/, '$1');
                if(Y.Lang.trim(key).length > 0) {
                    header_obj[key] = value;
                }
            }

            return header_obj;
        }
    });
    Y.ChessPGN = ChessPGN;
}, '0.0.1', {
    requires : ["node", "base", "plugin", "escape", "chess_position"]
});
