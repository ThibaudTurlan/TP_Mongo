const config = require('./config/config');
let express = require('express');
let app = express();
let server = require('http').createServer(app);
let twig = require('twig');
let mongoose = require('mongoose');
let getJSON = require('get-json');
let bodyParser = require("body-parser");
let sanitize = require('mongo-sanitize');
app.use(bodyParser.urlencoded({
    extended: false
}));
let url = "mongodb://localhost:27017/nancydb";

//CONFIGURATIONS
app.set('views', __dirname + '/ressources/views');
app.set('view engine', 'twig');

if (config.app.mode == 'dev') {
    twig.cache(false);
}

//MONGODB DATABASE

//Create Schema for parking
let parkingSchema = new mongoose.Schema({
    name: String,
    address: String,
    places: Number,
    capacity: Number,
    x: Number,
    y: Number,
    type: String
});

//Create Schema for Bike Station
let bikeSchema = new mongoose.Schema({
    name: String,
    address: String,
    x: Number,
    y: Number,
    stands: Number,
    bikes: Number
})

let Parking = mongoose.model('Parking', parkingSchema);
let Bike = mongoose.model('Bike', bikeSchema);

//Get parking data and save
getJSON('https://geoservices.grand-nancy.org/arcgis/rest/services/public/VOIRIE_Parking/MapServer/0/query?where=1%3D1&text=&objectIds=&time=&geometry=&geometryType=esriGeometryEnvelope&inSR=&spatialRel=esriSpatialRelIntersects&relationParam=&outFields=nom%2Cadresse%2Cplaces%2Ccapacite&returnGeometry=true&returnTrueCurves=false&maxAllowableOffset=&geometryPrecision=&outSR=4326&returnIdsOnly=false&returnCountOnly=false&orderByFields=&groupByFieldsForStatistics=&outStatistics=&returnZ=false&returnM=false&gdbVersion=&returnDistinctValues=false&resultOffset=&resultRecordCount=&queryByDistance=&returnExtentsOnly=false&datumTransformation=&parameterValues=&rangeValues=&f=pjson', function (error, response) {

    //Create database (named 'nancydb')
    mongoose.connect(url, {
        useNewUrlParser: true
    }, function (err, db) {
        if (err) throw err;
        console.log("Database nancydb created!");

        //Delete all previously data if exist
        Parking.deleteMany({}, function (err) {
            if (err) return handleError(err);
        });

        // Inserting all data
        // console.log(response.features.length);
        let i = 0;
        for (i; i < response.features.length; i++) {
            let park = new Parking({
                name: response.features[i].attributes.NOM,
                address: response.features[i].attributes.ADRESSE,
                places: response.features[i].attributes.PLACES,
                capacity: response.features[i].attributes.CAPACITE,
                x: response.features[i].geometry.x,
                y: response.features[i].geometry.y,
                type: 'parking'
            });

            park.save();
            // console.log(response.features[i].attributes.NOM);
        }
    });
});


getJSON('https://api.jcdecaux.com/vls/v1/stations?contract=Nancy&apiKey=76f63b7a53281f294547d0317b572d88c1aa041c', function (error, response) {

    //Create database (named 'nancydb')
    mongoose.connect(url, {
        useNewUrlParser: true
    }, function (err, db) {
        if (err) throw err;
        console.log("Database nancydb created!");

        //Delete all previously data if exist
        Bike.deleteMany({}, function (err) {
            if (err) return handleError(err);
        });

        // Inserting all data
        // console.log(response.features.length);
        let i = 0;
        for (i; i < response.length; i++) {
            let bike = new Bike({
                name: response[i].name,
                address: response[i].address,
                stands: response[i].available_bikes,
                bikes: response[i].available_bike_stands,
                x: response[i].position.lat,
                y: response[i].position.lng,
                type: 'bike'
            });
            bike.save();
            // console.log(response[i].name);
        }
    });
});

//ROUTES
app.use(express.static(__dirname + '/public'));

app.get('/', (req, res) => {
    res.render('maps.twig');
});

//Get data from database
app.get('/data/markers', (req, res) => {
    mongoose.connect(url, {useNewUrlParser: true}, function (err, db) {
        if (err) throw err;
        Parking.find(function (err, data) {
            if (err) return console.error(err);
            console.log("Get : " + data.length + " parking.");
            res.send(data);
        });
    });
});

// Get data from database
app.get('/data/markersbike', (req, res) => {
    mongoose.connect(url, {
        useNewUrlParser: true
    }, function (err, db) {
        if (err) throw err;
        Bike.find(function (err, dataBike) {
            if (err) return console.error(err);
            console.log("Get : " + dataBike.length + " bike.");
            res.send(dataBike);
        });
    });
});

// Adding a new point
app.post('/addPoint', (req, res) => {
    //Test all data with sanitize
    let pLat = sanitize(req.body.pointPositionLat);
    let pLng = sanitize(req.body.pointPositionLng);
    let pName = sanitize(req.body.pointName);
    let pAddress = sanitize(req.body.pointAddress);

    mongoose.connect(url, {
        useNewUrlParser: true
    }, function (err, db) {
        if (err) throw err;
        let park = new Parking({
            name: pName,
            address: pAddress,
            places: "",
            capacity: "",
            x: pLng,
            y: pLat,
            type: 'customPlace'
        });

        park.save();
    });

    res.redirect('/');
});

app.use(function (req, res, next) {
    res.status(404);
    res.type('txt').send('404 - Not found');
});

server.listen(config.app.port, () => {
    console.log(`Server run on port ${config.app.port}`);
});