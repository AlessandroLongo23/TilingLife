export const gameOfLifeRules = [
	{
		name: "Conway's Game of Life",
		rule: "B3/S23",
		description: "Classic Game of Life where cells survive with 2-3 neighbors and are born with exactly 3 neighbors."
	},
	{
		name: "Conway's Game of Life (5 Generations)",
		rule: "B3/S23/5",
		description: "Classic Conway's rules with 5 generations of cell states before death."
	},
	{
		name: "HighLife",
		rule: "B36/S23",
		description: "Similar to Conway's rules, but cells are also born with 6 neighbors. Features interesting replicators."
	},
	{
		name: "HighLife (4 Generations)",
		rule: "B36/S23/4",
		description: "HighLife rules with 4 generations of cell states before death."
	},
	{
		name: "Life without Death",
		rule: "B2/S34",
		description: "Cells are born with 2 neighbors and survive with 3-4 neighbors. Once alive, cells never die."
	},
	{
		name: "Life without Death (6 Generations)",
		rule: "B2/S34/6",
		description: "Life without Death rules with 6 generations of cell states before death."
	},
	{
		name: "Maze",
		rule: "B3/S12/8",
		description: "Cells are born with 3 neighbors and survive with 1-2 neighbors. Creates maze-like patterns with 8 generations."
	},
	{
		name: "Gnarl",
		rule: "B1/S1/10",
		description: "Minimalistic rule where cells are born and survive with exactly 1 neighbor. Creates complex branching patterns with 10 generations."
	},
	{
		name: "Seeds",
		rule: "B2/S",
		description: "Cells are born with exactly 2 neighbors and always die in the next generation."
	}
]; 