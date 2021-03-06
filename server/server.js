var express = require('express'),
  bodyParser = require('body-parser'),
  cors = require('cors'),
  dotenv = require('dotenv'),
  log = require('./util/LogUtil'),
  MongooseService = require('./service/MongooseService'),
  signals = require('signals');

dotenv.config({silent: true});

const app = express();

const index = {
  app,
  onInitComplete: new signals.Signal()
};

log.level = log.LEVEL_DEBUG;
log.info('__________________________________________________');
log.info('Hello! Starting Spotidrop initialization. Please wait...');

if (!process.env.MONGO_CONNECT)
  throw new Error('Please specify the MONGO_CONNECT env var. ie. MONGO_CONNECT=mongodb://username:password@hostname.foo.bar:27017/spotidrop-xxxx');

// Promise chain ensures DB is set up first, then app
MongooseService.connectToAppInstance(process.env.MONGO_CONNECT)
  // DB Setup complete. Safe to execute anything that creates Mongoose Models
  .then(() => {
    //AuthController = require( './controller/AuthController' );
  })
  .then(() => {
    app.use(bodyParser.urlencoded({extended: true}));
    app.use(bodyParser.json());

    //AuthController.init( app );

    // Routes
    const routes = {
      index: require('./controller/route/index'),
      playlists: require('./controller/route/playlists'),
      users: require('./controller/route/users'),
      me: require('./controller/route/me'),
      search: require('./controller/route/search')
    };

    app.use(cors());
    //app.use( '/media', express.static( __dirname + '/media' ) );

    app.use('/api', routes.index)
      .use('/api/playlists', routes.playlists)
      .use('/api/users', routes.users)
      .use('/api/me', routes.me)
      .use('/api/search', routes.search);

    // Start the server!
    app.listen(process.env.PORT);
    log.info(`Initialization complete! Hit me up on localhost:${process.env.PORT}!`);

    index.onInitComplete.dispatch();
  })
  .catch((err) => {
    log.error('FATAL app initialization error:\n', err, '\n', err.stack, '\nCan\'t recover! Ouch. Ugh. Dead.');
    process.exit(1);    // Fatal. Exit!
  })
  .done();

module.exports = index;
