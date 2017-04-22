(function(window, undefined)
{
	"use strict";

	var isFunction = function(f) {
		return f && typeof f === "function";
	}

	var findObjectInArray = function(arr, s, test)
	{
		for (var i = 0, l = arr.length; i < l; i++) {
			if (test( arr[i], s )) {
				return i;
			}
		}
	}

	var cloneObject = function(a) {
		return JSON.parse(JSON.stringify(a));
	}

	var extend = function ( defaults, options ) {
	    var extended = {};
	    var prop;
	    for (prop in defaults) {
	        if (Object.prototype.hasOwnProperty.call(defaults, prop)) {
	            extended[prop] = defaults[prop];
	        }
	    }
	    for (prop in options) {
	        if (Object.prototype.hasOwnProperty.call(options, prop)) {
	            extended[prop] = options[prop];
	        }
	    }
	    return extended;
	}





	var YaSchool = {

		config: {
			
		},

		data: {
			"schools": {},
			"rooms": {},
			"lessons": {},
			"lecturers": {},
		},

		models: {
			lesson: {
				"_id"			: null, 
				"title"			: ""
			},
			room: {
				"_id"			: null, 
				"title"			: "", 
				"capacity"		: 0, 
				"location"		: ""
			},
			lecturer: {
				"_id"			: null, 
				"name"			: "",
				"ava"			: "",
				"bio"			: "",

			},
			school: {
				"_id"			: null, 
				"title"			: "", 
				"studentsCount"	: 0,
				"shortTitle" 	: ""
			}
		},

		events: {
			"afterAnyAdded"		: null,
			"afterAnyDeleted"	: null,
			"afterAnyUpdated"	: null,
			"scheduleChanged"	: null
		},


		getGUID: function() {
			var S4 = function() {
			   return (((1+Math.random())*0x10000)|0).toString(16).substring(1);
			}

			return (S4()+S4()+"-"+S4()+"-"+S4()+"-"+S4()+"-"+S4()+S4()+S4());
		},



		init: function(config) {

			config = config || {};
			this.config = extend(this.config, config);

			this.data = this.config.data;

			return this;
		},



		//
		on: function(eventName, callback) {

			var _this = this;

			if ( !isFunction(callback) ) {
				return false; /* todo: throw error */
			}

			if ( !eventName ) {
				return false;/* todo: throw error */
			}

			// Event not found
			if ( !Object.prototype.hasOwnProperty.call(this.events, eventName) ) {
				return false;/* todo: throw error */
			}

			this.events[ eventName ] = callback;

			return this;
		}, //on



		getData: function(itemsType) {

			if ( !itemsType )
			{
				return this.data;
			}

			if ( !this.data[itemsType]) {
				return false;
			}
			return this.data[itemsType];
		},

		addItem: function(itemType, itemData, callback) {

			if ( !this.models[itemType] || !this.data[itemType+'s']) {
				return false;
			}

			itemData = itemData || {};

			// Create blank model
			var newItem = cloneObject( this.models[itemType] );

			// Set unique ID
			itemData._id = this.getGUID();

			// Add item
			this.data[itemType+'s'][itemData._id] = extend(newItem, itemData);

			// Init callback
			if ( isFunction(callback) ) {
				callback( newItem );
			}

			// Вызываем событие afterAnyAdded
			if ( isFunction(this.events.afterAnyAdded) ) {
				this.events.afterAnyAdded( itemType, newItem );
			}

			return itemData._id;
		},
		
		// TODO:
		removeItem: function(id, itemType) {
			if ( !this.models[itemType]) {
				return false;
			}
		}, // remove

		// TODO:
		updateItem: function(id, itemType, itemData) {
			if ( !this.models[itemType]) {
				return false;
			}
		}


	}

	window.YaSchool = YaSchool;

}(window));