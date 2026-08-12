exports.handler = async (event) => {
	return {
		response: "This is a placeholder response from the FAQ agent.",
		connectionId: event?.connectionId
	};
};
