class Goshawk {
	static connect(url) {
		return new GosConnection(url).connect()
	}
}