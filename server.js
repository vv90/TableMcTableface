// This is mostly a dummy server
// Its only purpose is to serve a large collection of transaction to the frontend

var express = require('express');
var fs = require('fs');

var app = express();


var transactions = [];
var options = {
	page: 1,
	pageLength: 50,
	sortColumn: 'FullName',
	sortDirection: 'desc'
};

app.use(express.static('public'));

app.get('/',
	function (request, response) {
	response.sendFile(__dirname + '/public/' + 'app.html');
});

app.get('/api/transactions/', function (request, response) {
	if (transactions.length === 0) {
		response.status(500).send("Server data access error");
	}
	
	var page = parseInt(request.query.page) || options.page;
	var pageLength = parseInt(request.query.pageLength) || options.pageLength;
	
	var startIndex = Math.min((page - 1) * pageLength, transactions.length);
	var endIndex = Math.min(page * pageLength, transactions.length);
	
	if (startIndex >= endIndex) {
		response.status(500).send("Incorrect paging values");
	}
	
	var sortColumn = (request.query.sortColumn && transactions[0].hasOwnProperty(request.query.sortColumn))
			? request.query.sortColumn 
			: options.sortColumn;
	
	var sortDirection = (request.query.sortDirection === 'asc' || request.query.sortDirection === 'desc')
			? request.query.sortDirection 
			: options.sortDirection;
	
	// This part of course should not be used in the production
	// Instead there will be a query to the database instead of in-memory array
    transactions.sort(function (a, b) {
		if (a[sortColumn] < b[sortColumn]) return (sortDirection === 'desc') ? 1 : -1;
		else if (a[sortColumn] > b[sortColumn]) return (sortDirection === 'desc') ? -1 : 1;
        else return 0;
    });
	
	response.send({
		totalRecords: transactions.length,
		from: startIndex,
		to: endIndex,
		data: transactions.slice(startIndex, endIndex)
	});
});

var server = app.listen(1337, function () {
	fs.readFile(__dirname + '/public/transactions.json', 'utf8', function (error, data) {
		transactions = JSON.parse(data);
		console.log("Server started at port 1337");
	});
});