(function() {
	'use strict';

	function Cell(data, columnDescription, skipFormatting) {
		var monthNames = [
			"Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
		];

		var formatters = {
			text: function(rawData) {
				return rawData;
			},
			email: function(rawData) {
				return $('<a>').attr('href', 'mailto:' + rawData).text(rawData);
			},
			currency: function(rawData) {
				return $('<span>')
					.attr('class', rawData > 0 ? 'positive' : 'negative')
					.text('$' + (Math.round((parseFloat(rawData) + 0.001) * 100) / 100).toFixed(2));
			},
			date: function(rawData) {
				var date = new Date(rawData);
				return monthNames[date.getMonth()] + ' ' + date.getDate() + ', ' + date.getFullYear();
			},
			icon: function(rawData) {
				return $('<i>')
					.attr('class', rawData ? 'fa fa-money' : 'fa fa-credit-card')
					.attr('title', rawData ? 'Cash transaction' : 'Credit card transaction');
			}
		};

		function formatData(rawData, dataType) {
			var formatter = formatters[dataType] || formatters['text'];

			return formatter(rawData);
		}

		this.skipFormatting = skipFormatting;
		this.data = skipFormatting ? data : formatData(data, columnDescription.dataType);
		this.column = columnDescription;
	}


	function Table(element, options) {

		if (!options.columns || !options.columns.length)
			return;

		var self = this;

		this.element = element;
		this.options = options;
		
		// hold the current actual state of the table
		var state = {
			page: 1,
			pageLength: 15,
			sortColumn: options.columns[0].propertyName,
			sortDirection: 'asc'
		};
		
		// try loading saved setting from local storage
		try {
			$.extend(state, JSON.parse(localStorage.getItem('options')));
		} catch (err) {
			console.log("Failed to read locally saved settings");
		}

		function toggleSorting(headerElement) {
			var column = $(headerElement).closest('[data-column]').attr('data-column');
			var direction = (column === state.sortColumn && state.sortDirection === 'asc' ? 'desc' : 'asc');

			self.sort(column, direction);
		}

		function setSortingClasses(column, direction) {
			// reset all sorting classes in the table head
			$(self.element).find('thead th > .table-title-text').removeClass('table-sort-asc table-sort-desc');

			if (!column) return;

			var $element = $(self.element).find('thead th[data-column="' + column + '"] > .table-title-text');

			if (!$element.length) {
				console.log("Unable to find sorting header for column [" + column + "]");
				return;
			}

			if (direction === 'asc') {
				$element.addClass('table-sort-asc');
			} else if (direction === 'desc') {
				$element.addClass('table-sort-desc');
			}
		}

		function createRow(rowData, isHead) {
			var row = $('<tr>');

			rowData.forEach(function(cell) {
				if (isHead) {
					var heading = $('<span>')
						.attr('class', 'table-title-text')
						.append(cell.data);

					if (cell.column.sortable)
						heading.click(function() { toggleSorting(this); }).addClass('table-title-sortable');

					row.append($('<th>')
						.attr('class', 'table-cell table-cell-' + cell.column.dataType)
						.attr('data-column', cell.column.propertyName)
						.append(heading));
				} else {
					row.append($('<td>')
						.attr('class', 'table-cell table-cell-' + cell.column.dataType)
						.append(cell.data));
				}
			});

			return row;
		}

		function navigate(pageNumber) {
			loadData({ page: pageNumber });
		}

		function createPagination(selectedPage, from, to, total) {
			var pagination = $(element).next('.table-pagination');
			pagination.empty();
			var paginationItemsNumber = 8;
			var totalPages = Math.ceil(total / state.pageLength);
			var middlePoint = Math.ceil(paginationItemsNumber / 2);
			var firstPage;

			if (selectedPage <= middlePoint)
				firstPage = 1;
			else if (selectedPage > totalPages - middlePoint)
				firstPage = totalPages - (paginationItemsNumber - 1);
			else
				firstPage = selectedPage - middlePoint;
			

			function createPaginationItem(page, text, selected) {
				var item = $('<span>')
					.attr('class', 'table-pagination-item')
					.text(text);

				if (page && !selected) {
					item.click(navigate.bind(undefined, page));
				}
				if (!page) {
					item.addClass('filler');
				}

				if (selected) {
					item.addClass('selected');
				}

				return item;
			}

			if (selectedPage !== firstPage) {
				pagination.append(createPaginationItem(selectedPage - 1, '<'));
			}

			if (firstPage !== 1) {
				pagination.append(createPaginationItem(1, '1'));
				pagination.append(createPaginationItem(undefined, '...'));
			}

			for (var i = 0; i < paginationItemsNumber; i++) {
				pagination.append(createPaginationItem(firstPage + i, firstPage + i, selectedPage === firstPage + i));
			}

			if (totalPages !== firstPage + paginationItemsNumber - 1) {
				pagination.append(createPaginationItem(undefined, '...'));
				pagination.append(createPaginationItem(totalPages, totalPages));
			}

			if (selectedPage !== totalPages) {
				pagination.append(createPaginationItem(selectedPage + 1, '>'));
			}

			return pagination;
		}

		function loadData(query) {
			// display loading overlay
			var overlay = $(self.element).prev('.table-overlay');
			overlay.removeClass('hidden');

			// fill the missing query parameters (if any) from the current state of the table
			query = $.extend({}, state, query);

			var tbody = $(self.element).find('tbody');

			var url = self.options.apiUrl;

			for (var prop in query) {
				if (!query.hasOwnProperty(prop) || query[prop] === undefined) continue;

				url += ((url.indexOf('?') > -1 ? '&' : '?') + prop + '=' + query[prop]);
			}

			return $.get(url)
				.done(function (response) {
					$.extend(state, query);
					localStorage.setItem('options', JSON.stringify(state));

					tbody.empty();
					
					// update rows
					response.data.forEach(function(item) {
						var rowValues = self.options.columns.map(function(column) {
							return new Cell(item[column.propertyName], column);
						});

						tbody.append(createRow(rowValues));
					});

					// update pagination
					createPagination(state.page, response.from, response.to, response.totalRecords)
						.insertAfter(self.element);
					
					overlay.addClass('hidden');
				});
		}

		this.sort = function(column, direction) {
			loadData({ sortColumn: column, sortDirection: direction })
				.done(function() {
					setSortingClasses(column, direction);
				});
		}
		

		this.init = function() {
			var $table = $(this.element);

			$table.empty();

			$table.append($('<thead>')
				.append(createRow(this.options.columns.map(function(column) {
						return new Cell(column.displayName, column, true);
					}),
					true)));

			$table.append($('<tbody>'));
			$('<div>').attr('class', 'table-pagination').insertAfter($table);
			$('<div>')
				.attr('class', 'table-overlay hidden')
				.append($('<h1>').attr('class', 'table-overlay-text').text('Loading...'))
				.insertBefore($table);

			setSortingClasses(state.sortColumn, state.sortDirection);

			var query = {
				page: state.page,
				pageLength: state.pageLength,
				sortColumn: state.sortColumn,
				sortDirection: state.sortDirection
			};

			loadData(query);

			return this;
		}
	}
	
	// configure the table
	var options = {
		columns: [
			{ propertyName: 'Id', displayName: '#', dataType: 'text', sortable: true },
			{ propertyName: 'Customer', displayName: 'Customer', dataType: 'text', sortable: true },
			{ propertyName: 'Email', displayName: 'Email', dataType: 'email', sortable: true },
			{ propertyName: 'Date', displayName: 'Date', dataType: 'date', sortable: true },
			{ propertyName: 'Amount', displayName: 'Amount', dataType: 'currency', sortable: true },
			{ propertyName: 'IsCash', displayName: '', dataType: 'icon', sortable: false }
		],
		apiUrl: '/api/transactions'
	}
	
	new Table(document.getElementById('table'), options).init();
})();