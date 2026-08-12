exports.handler = async (event) => {
	return {
		response: "This is a placeholder response from the booking agent.",
		connectionId: event?.connectionId
	};
};
